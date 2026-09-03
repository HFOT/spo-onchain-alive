'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {type WorldProps,type ChainBlock,hsl,mix32,hueOf} from './chain-kit';

/* The chain, as it stands.
   ------------------------------------------------------------------
   A block explorer for a chain that does not behave like the one everybody
   draws explorers for. Bitcoin's blocks are boxes because they stack: work is
   found at irregular intervals and the queue in front of them is public, so
   fullness and fee pressure are the story. Cardano's arrive on a clock - one
   roughly every twenty seconds whether or not anyone has anything to send -
   and there is no queue to look at, because a node's mempool is its own and
   the next slot's leader is not known to anybody but that leader. Measured
   over an hour: 18.9 seconds a block, a median of three transactions, one
   block in five completely empty.

   Drawn as fullness bars that would read as a broken page. Drawn as a shell
   with its transactions floating inside it, three is three and empty is empty,
   and neither has to be dressed up. So: spheres.

   What is worth knowing about a Cardano block is who made it, and that is the
   one thing this site already knows how to draw. Every block here is tinted
   with its producer's colour and opens that producer's artwork. */


const V=`#version 300 es
precision highp float;
in vec2 P;          // corner of the quad, -1..1
in vec4 A;          // centre x, centre y, radius, 1 = shell
in vec4 B;          // rgb, and w: roughness for a transaction, unused on a shell
uniform vec2 VP;uniform float T;
out vec2 UV;out vec4 COL;out float KIND,RAD;
void main(){
 UV=P;COL=B;KIND=A.w;RAD=A.z;
 /* A bubble is never quite a circle. Two out-of-phase wobbles, seeded off the
    sphere's own position so neighbours never breathe in unison, are the whole
    difference between something floating and something printed. */
 vec2 w=vec2(1.);
 if(A.w>.5)w=vec2(1.+.022*sin(T*1.27+A.x*.031),1.+.022*sin(T*1.09+A.y*.043+2.1));
 gl_Position=vec4((A.xy+P*A.z*w)/VP*2.-1.,0.,1.);
 gl_Position.y=-gl_Position.y;
}`;

const F=`#version 300 es
precision highp float;
in vec2 UV;in vec4 COL;in float KIND,RAD;
uniform float T;
out vec4 O;
/* Thin-film colour. Soap is colourless; the bands come from the film being a
   few wavelengths thick, so what is seen shifts with both the thickness and
   the angle it is seen at. A cosine palette over that product is a cheap stand
   in and lands in the right place: bands, not a tint. */
vec3 film(float t){return .5+.5*cos(6.2832*(t+vec3(0.,.34,.68)));}
float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
void main(){
 float r2=dot(UV,UV),r=sqrt(r2);
 /* Antialiasing by derivative rather than by discard. A hard cutoff leaves a
    stair-stepped silhouette that crawls as the bubble breathes, and any band
    narrower than a pixel - which the film's lip is on the small spheres -
    flickers as it crosses the sample grid. fwidth gives the width of a pixel
    in these coordinates, so nothing is ever drawn thinner than one. */
 float px=fwidth(r);
 float mask=1.-smoothstep(1.-px*1.1,1.+px*.7,r);
 if(mask<=.001)discard;
 vec3 n=vec3(UV,sqrt(max(0.,1.-r2)));
 vec3 lit=normalize(vec3(-.42,.55,.72));
 if(KIND>.5){
  /* The bubble.
     Reflectivity is Schlick's fresnel, which is where a soap film's brightness
     actually comes from: near zero looking straight through it, climbing hard
     at grazing angles. That single smooth curve replaces the thin bright ring
     this used to draw, and it is what stopped the edge shimmering - a curve
     has no width to fall below a pixel.

     The film drains downward under gravity, so it is thinner at the top than
     the bottom, and the interference bands ride that gradient. A little noise
     keeps it from looking like an equation. */
  float cosT=max(n.z,.001);
  float F=.02+.98*pow(1.-cosT,5.);
  float thick=.52+.46*(.5-n.y*.5)
             +.05*sin(T*.5+n.x*3.1)
             +.035*hash(floor((n.xy+T*.02)*7.));
  vec3 iri=film(thick*(1./max(cosT,.22))*1.15+T*.02);
  // The far wall of the bubble is seen through the near one, so there is a
  // second, dimmer rim inside the bright one.
  float inner=pow(1.-cosT,13.);
  /* No specular. A real bubble has one, but on an empty block it is the only
     thing inside the shell and it reads as a smudge on the glass rather than
     as light on it - and an empty block is one in five. The film carries the
     whole read; nothing floats in the middle of nothing. */
  vec3 c=mix(COL.rgb,iri,.6)*(.42+1.15*F);
  /* A small bubble has the same film as a large one, but far fewer pixels to
     show it in, so its rim comes out to almost nothing. This gives the little
     ones back what the resolution took - the same compensation a minimum line
     width makes, not a different material. */
  float small=1.+1.15*clamp(1.-RAD/72.,0.,1.);
  float a=(F*.78+inner*.46)*mask*small;
  O=vec4(c*a,min(a,.95));
 }else{
  /* A transaction. Hardness is a real parameter here, not a switch: roughness
     widens the highlight and dims it in the same move, the way a rough surface
     spreads the same light over more of itself. A smooth one takes a small
     hard pip, a rough one a broad sheen, and neither is brighter overall. */
  float rough=clamp(COL.w,.06,1.),a2=rough*rough;
  vec3 h=normalize(lit+vec3(0.,0.,1.));
  float ndh=max(0.,dot(n,h));
  float d=a2/(3.14159*pow(ndh*ndh*(a2-1.)+1.,2.));
  float F=.04+.96*pow(1.-max(n.z,0.),5.);
  // A wrapped diffuse term: the terminator on a small ball is soft, not a line.
  float wrap=max(0.,(dot(n,lit)+.34)/1.34);
  vec3 c=COL.rgb*(.16+wrap*.92)
        +COL.rgb*.09*max(0.,-n.y)          // bounce from below
        +vec3(d*.05+F*.22*(1.-rough));
  O=vec4(c*mask,mask);
 }
}`;

function sh(gl:WebGL2RenderingContext,t:number,src:string){const s=gl.createShader(t)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s}
function prog(gl:WebGL2RenderingContext,v:string,f:string){const p=gl.createProgram()!;gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program');return p}

/* A block's shell grows with its size, but on a log, because the range runs
   from a four-byte header to tens of kilobytes and a linear scale would draw
   most of the chain as dust. */
const shellScale=(sz:number)=>.62+.38*Math.min(1,Math.log10(1+Math.max(0,sz))/4.4);

type Sphere={x:number;y:number;r:number;c:[number,number,number];shell:boolean;rough?:number};

export default function WorldGlass({chain,tickers,onPick,lang}:WorldProps){
 const canvas=useRef<HTMLCanvasElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const slots=useRef<Map<number,HTMLElement>>(new Map());
 const focusBox=useRef<HTMLDivElement>(null);
 const [focus,setFocus]=useState<ChainBlock|null>(null);
 const blocks=chain?.blocks||[];
 const latest=blocks[0]||null;
 const shown=focus||latest;

 const setSlot=useCallback((h:number,el:HTMLElement|null)=>{
  if(el)slots.current.set(h,el);else slots.current.delete(h);
 },[]);

 useEffect(()=>{
  const c=canvas.current,st=stage.current;
  if(!c||!st)return;
  const gl=c.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});
  if(!gl){c.dataset.fallback='true';return}
  const p=prog(gl,V,F),vao=gl.createVertexArray(),quad=gl.createBuffer(),inst=gl.createBuffer();
  gl.bindVertexArray(vao);
  // Two triangles, reused by every sphere on the page.
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const lp=gl.getAttribLocation(p,'P');
  gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,inst);
  const la=gl.getAttribLocation(p,'A'),lb=gl.getAttribLocation(p,'B');
  gl.enableVertexAttribArray(la);gl.vertexAttribPointer(la,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(la,1);
  gl.enableVertexAttribArray(lb);gl.vertexAttribPointer(lb,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(lb,1);
  const uVP=gl.getUniformLocation(p,'VP'),uT=gl.getUniformLocation(p,'T');
  let raf=0,t0=0;
  const buf:number[]=[];

  const push=(s:Sphere)=>{buf.push(s.x,s.y,s.r,s.shell?1:0,s.c[0],s.c[1],s.c[2],s.rough??.5)};

  /* The transactions inside a shell.
     Their places are fixed per block - the same block always looks the same -
     and they drift, because a still one looks like a diagram and a moving one
     looks like it is holding something.

     They are not identical beads. The average size is real: a block's bytes
     divided by its transactions, so one fat transaction and a dozen thin ones
     do not draw the same. The spread around that average, and how hard or soft
     each one shades, is not - the feed carries no per-transaction size, and
     inventing one and drawing it as if measured is the one thing this site
     does not do. It is variation, not a reading. */
  const inside=(b:ChainBlock,cx:number,cy:number,R:number,time:number,dpr:number)=>{
   const n=Math.min(b.tx,48);
   if(!n)return;
   const seed=(b.h>>>0)^0x5bf03635;
   const hue=hueOf(b,tickers);
   // Mean bytes a transaction, on a log: the range runs from a few hundred to
   // several thousand and a linear scale would flatten it.
   const mean=b.sz/Math.max(1,b.tx);
   const bulk=.055+.055*Math.min(1,Math.max(0,Math.log10(1+mean)-2)/2.2);
   for(let i=0;i<n;i++){
    /* Every quantity gets its own draw. Sharing one between the polar angle
       and the drift speed - which is easy to do by accident - ties where a
       transaction sits to how fast it moves, and the crowd collects in one
       corner instead of filling the bubble. */
    const u=mix32(seed,i*6+1),v=mix32(seed,i*6+2),w=mix32(seed,i*6+3);
    const g=mix32(seed,i*6+4),k=mix32(seed,i*6+5),m=mix32(seed,i*6+6);
    const rad=R*.62*Math.cbrt(.1+.9*u);
    const th=v*6.2832+time*(.14+k*.24);
    const ph=Math.acos(1-2*w);
    // Each one keeps its own slow loop, so the crowd never pulses together.
    const bob=Math.sin(time*(.45+m*.6)+i*1.7)*R*.032;
    push({x:cx+Math.cos(th)*Math.sin(ph)*rad+Math.cos(time*.3+i*2.2)*R*.014,
          y:cy+Math.cos(ph)*rad*.8+bob,
          r:Math.max(1.6*dpr,R*bulk*(.6+.9*g)),
          c:hsl(hue,.48+.24*k,.56+.24*m),shell:false,rough:g});
   }
  };

  const draw=(now:number)=>{
   if(!t0)t0=now;
   const time=(now-t0)/1000;
   const dpr=Math.min(devicePixelRatio||1,2),b=st.getBoundingClientRect();
   const W=Math.max(2,Math.round(b.width*dpr)),H=Math.max(2,Math.round(b.height*dpr));
   if(c.width!==W||c.height!==H){c.width=W;c.height=H}
   buf.length=0;
   // The row: one shell per block, sat in whatever box the layout gave it.
   // On a narrow screen that row scrolls sideways, and the canvas sits above
   // it, so a sphere has to be clipped to the row the way its label already is.
   const rowEl=st.querySelector('.chain-row');
   const row=rowEl?rowEl.getBoundingClientRect():null;
   for(const blk of blocks){
    const el=slots.current.get(blk.h);
    if(!el)continue;
    const r=el.getBoundingClientRect();
    if(row&&(r.left+r.width/2<row.left||r.left+r.width/2>row.right))continue;
    const cx=(r.left-b.left+r.width/2)*dpr,cy=(r.top-b.top+r.height/2)*dpr;
    const R=Math.min(r.width,r.height)/2*dpr*shellScale(blk.sz);
    if(cx<-R||cx>W+R)continue;
    const hue=hueOf(blk,tickers);
    push({x:cx,y:cy,r:R,c:hsl(hue,.7,.62),shell:true});
    inside(blk,cx,cy,R,time+blk.h*.37,dpr);
   }
   // The one being looked at, large enough to count what is in it.
   const fb=focusBox.current;
   if(fb&&shown){
    const r=fb.getBoundingClientRect();
    const cx=(r.left-b.left+r.width/2)*dpr,cy=(r.top-b.top+r.height/2)*dpr;
    const R=Math.min(r.width,r.height)/2*dpr*.86;
    const hue=hueOf(shown,tickers);
    push({x:cx,y:cy,r:R,c:hsl(hue,.72,.6),shell:true});
    inside(shown,cx,cy,R,time,dpr);
   }
   const n=buf.length/8;
   gl.viewport(0,0,W,H);
   gl.clearColor(0,0,0,0);
   gl.clear(gl.COLOR_BUFFER_BIT);
   if(n){
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,inst);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(buf),gl.DYNAMIC_DRAW);
    gl.uniform2f(uVP,W,H);
    gl.uniform1f(uT,time);
    gl.drawArraysInstanced(gl.TRIANGLES,0,6,n);
   }
   raf=requestAnimationFrame(draw);
  };
  raf=requestAnimationFrame(draw);
  return()=>{
   cancelAnimationFrame(raf);
   gl.deleteBuffer(quad);gl.deleteBuffer(inst);
   gl.deleteVertexArray(vao);gl.deleteProgram(p);
  };
 },[blocks,shown,tickers]);

 const t=lang==='ja'?JA:EN;
 const ep=chain?.epoch,tip=chain?.tip;
 const pct=ep&&tip?tip.epoch_slot/ep.slots:0;
 const left=ep&&tip?(ep.slots-tip.epoch_slot):0;
 const fill=ep&&tip&&tip.epoch_slot?ep.blocks/tip.epoch_slot:0;
 const seen=chain?new Date(chain.at):null;

 return <section className="chain" ref={stage}>
  <canvas ref={canvas} className="chain-canvas" aria-hidden="true"/>

  <header className="chain-head">
   <h1><span>{t.kicker}</span>CARDANO BLOCKCHAIN<br/>ALIVE.</h1>
   <div className="chain-epoch">
    <div className="ce-top"><b>EPOCH {ep?.no??'—'}</b><span>{(pct*100).toFixed(2)}%</span></div>
    <i><em style={{width:`${(pct*100).toFixed(2)}%`}}/></i>
    <div className="ce-bot">
     <span>{t.left(left)}</span>
     <span>{ep?ep.slots.toLocaleString():'—'} {t.slots}</span>
    </div>
   </div>
  </header>

  {/* Newest on the right, the way a chain grows. */}
  <div className="chain-row" role="list" aria-label={t.recent}>
   {blocks.slice(0,14).reverse().map(b=>{
    const known=tickers.has(b.p),tk=tickers.get(b.p)||'';
    return <button key={b.h} role="listitem" type="button"
      className={`chain-block${shown?.h===b.h?' on':''}`}
      onMouseEnter={()=>setFocus(b)} onFocus={()=>setFocus(b)}
      onClick={()=>onPick?.(b.p)}
      style={{'--blk-hue':`${Math.round(hueOf(b,tickers)*360)}deg`} as React.CSSProperties}>
     <b>{b.h.toLocaleString()}</b>
     <span ref={el=>setSlot(b.h,el)} className="cb-ball" aria-hidden="true"/>
     <em>{b.tx} tx</em>
     <i>{tk||(known?t.noname:t.unranked)}</i>
    </button>;
   })}
  </div>

  <div className="chain-panels">
   <div className="chain-focus">
    <p className="cp-label">{t.newest}</p>
    <div className="cf-ball" ref={focusBox} aria-hidden="true"/>
    {shown?<>
     <dl className="cf-meta">
      <div><dt>{t.height}</dt><dd>{shown.h.toLocaleString()}</dd></div>
      <div><dt>TX</dt><dd>{shown.tx}</dd></div>
      <div><dt>{t.size}</dt><dd>{shown.sz.toLocaleString()} B</dd></div>
      <div><dt>{t.slot}</dt><dd>{shown.es.toLocaleString()}</dd></div>
     </dl>
     <button className="cf-open" type="button" onClick={()=>onPick?.(shown.p)}>
      <b>{tickers.get(shown.p)||(tickers.has(shown.p)?t.noname:t.unranked)}</b><span>{t.open}</span>
     </button>
    </>:<p className="cp-empty">{t.nofeed}</p>}
   </div>

   <div className="chain-stats">
    <p className="cp-label">{t.state}</p>
    <dl>
     <div><dt>{t.height}</dt><dd>{tip?tip.height.toLocaleString():'—'}</dd></div>
     <div><dt>{t.epBlocks}</dt><dd>{ep?ep.blocks.toLocaleString():'—'}</dd></div>
     <div><dt>{t.epTxs}</dt><dd>{ep?ep.txs.toLocaleString():'—'}</dd></div>
     <div><dt>{t.fill}</dt><dd>{(fill*100).toFixed(1)}%</dd></div>
    </dl>
    <p className="cp-note">{t.fillNote}</p>
    <p className="cp-seen">{t.seen} {seen?seen.toLocaleString():'—'}{chain?.error?` · ${chain.error}`:''}</p>
   </div>
  </div>
 </section>;
}

const JA={
 kicker:'チェーンのいま',
 recent:'直近のブロック',newest:'ブロックの中身',state:'チェーンの状態',
 height:'ブロック高',size:'サイズ',slot:'エポック内スロット',slots:'スロット',
 epBlocks:'このエポックのブロック',epTxs:'このエポックの tx',fill:'スロット充填率',
 fillNote:'Cardanoは需要と無関係に約20秒ごとにブロックを作ります。空のブロックは異常ではありません。',
 open:'このプールのアートへ',unranked:'ランキング外',noname:'Ticker未設定',
 seen:'観測',nofeed:'チェーンを読めませんでした。',
 left:(s:number)=>`残り ${(s/86400).toFixed(2)} 日`,
} as const;
const EN={
 kicker:'THE CHAIN, AS IT STANDS',
 recent:'RECENT BLOCKS',newest:'INSIDE THE BLOCK',state:'CHAIN STATE',
 height:'HEIGHT',size:'SIZE',slot:'EPOCH SLOT',slots:'SLOTS',
 epBlocks:'BLOCKS THIS EPOCH',epTxs:'TX THIS EPOCH',fill:'SLOTS FILLED',
 fillNote:'Cardano makes a block about every twenty seconds whether or not anyone is sending. An empty block is not a fault.',
 open:'OPEN THIS POOL',unranked:'UNRANKED',noname:'NO TICKER',
 seen:'OBSERVED',nofeed:'The chain could not be read.',
 left:(s:number)=>`${(s/86400).toFixed(2)} DAYS LEFT`,
} as const;
