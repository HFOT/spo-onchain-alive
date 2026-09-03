'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {poolHue} from './pool-hue';

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

export type ChainBlock={h:number;s:number;es:number;e:number;t:number;tx:number;sz:number;p:string};
export type Chain={
 at:string;source:string;error?:string;
 tip?:{epoch:number;epoch_slot:number;abs_slot:number;height:number;time:number};
 epoch?:{no:number;slots:number;blocks:number;txs:number;fees:string;active_stake:string;start_time:number;end_time:number};
 blocks:ChainBlock[];
};

const V=`#version 300 es
precision highp float;
in vec2 P;          // corner of the quad, -1..1
in vec3 C;          // centre x, centre y, radius - all in device pixels
in vec4 K;          // rgb, and w: 1 = hollow shell, 0 = solid
uniform vec2 VP;
out vec2 UV;out vec4 COL;
void main(){
 UV=P;COL=K;
 vec2 px=C.xy+P*C.z;
 gl_Position=vec4(px/VP*2.-1.,0.,1.);
 gl_Position.y=-gl_Position.y;
}`;

const F=`#version 300 es
precision highp float;
in vec2 UV;in vec4 COL;
out vec4 O;
void main(){
 float r2=dot(UV,UV);
 if(r2>1.)discard;
 /* The quad is flat; the sphere is in the shading. Reconstructing a normal
    from the corner coordinate gives a lit ball for the cost of two triangles,
    which is what makes a hundred of them free. */
 vec3 n=vec3(UV,sqrt(1.-r2));
 vec3 lit=normalize(vec3(-.42,.55,.72));
 float lam=max(0.,dot(n,lit));
 float rim=pow(1.-n.z,3.);
 if(COL.w>.5){
  /* The shell. A defined edge with almost nothing behind it, the way a bubble
     is mostly the light that grazes it - a soft falloff alone reads as a ball
     of fog rather than as something hollow, and the transactions inside have
     to stay visible through it. */
  float edge=smoothstep(.62,.99,r2);
  float a=edge*.8+rim*.16+lam*.03;
  O=vec4(COL.rgb*a*1.7,a*.7);
 }else{
  /* A transaction. Solid, with a specular pip, so a block with eight of them
     reads as eight things and not as texture. */
  float spec=pow(max(0.,dot(reflect(-lit,n),vec3(0.,0.,1.))),22.);
  vec3 c=COL.rgb*(.28+lam*.85)+vec3(spec*.7);
  float a=smoothstep(1.,.86,r2);
  O=vec4(c*a,a);
 }
}`;

function sh(gl:WebGL2RenderingContext,t:number,src:string){const s=gl.createShader(t)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s}
function prog(gl:WebGL2RenderingContext,v:string,f:string){const p=gl.createProgram()!;gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program');return p}
function hsl(h:number,s:number,l:number){const a=s*Math.min(l,1-l);const f=(n:number)=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(Math.min(k-3,9-k),1))};return[f(0),f(8),f(4)] as [number,number,number]}
function mix32(seed:number,n:number){let x=Math.imul(seed^(n+0x9e3779b9),2654435761);x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;return(x>>>0)/4294967295}

/* A block's shell grows with its size, but on a log, because the range runs
   from a four-byte header to tens of kilobytes and a linear scale would draw
   most of the chain as dust. */
const shellScale=(sz:number)=>.62+.38*Math.min(1,Math.log10(1+Math.max(0,sz))/4.4);

type Sphere={x:number;y:number;r:number;c:[number,number,number];shell:boolean};

export default function ChainExplorer({chain,tickers,onPick,lang}:{
 chain:Chain|null;
 /** Pool id to ticker, from the ranking. A producer outside it has no name
     here, only its own colour, which is the honest way to show it. */
 tickers:Map<string,string>;
 onPick?:(pool:string)=>void;
 lang:'ja'|'en';
}){
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
  const lc=gl.getAttribLocation(p,'C'),lk=gl.getAttribLocation(p,'K');
  gl.enableVertexAttribArray(lc);gl.vertexAttribPointer(lc,3,gl.FLOAT,false,28,0);gl.vertexAttribDivisor(lc,1);
  gl.enableVertexAttribArray(lk);gl.vertexAttribPointer(lk,4,gl.FLOAT,false,28,12);gl.vertexAttribDivisor(lk,1);
  const uVP=gl.getUniformLocation(p,'VP');
  let raf=0,t0=0;
  const buf:number[]=[];

  const push=(s:Sphere)=>{buf.push(s.x,s.y,s.r,s.c[0],s.c[1],s.c[2],s.shell?1:0)};

  /* The transactions inside a shell. Their places are fixed per block - the
     same block always looks the same - and they drift, because a still one
     looks like a diagram and a moving one looks like it is holding something.
     Packed on a sphere rather than a disc so the count reads at a glance. */
  const inside=(b:ChainBlock,cx:number,cy:number,R:number,time:number,dpr:number)=>{
   const n=Math.min(b.tx,48);
   if(!n)return;
   const seed=(b.h>>>0)^0x5bf03635;
   const hue=poolHue(tickers.get(b.p)||'',b.p);
   const col=hsl(hue,.62,.68);
   for(let i=0;i<n;i++){
    const u=mix32(seed,i*3+1),v=mix32(seed,i*3+2),w=mix32(seed,i*3+3);
    const rad=R*.62*Math.cbrt(.15+.85*u);
    const th=v*6.2832+time*(.18+w*.22);
    const ph=Math.acos(1-2*w);
    push({x:cx+Math.cos(th)*Math.sin(ph)*rad,
          y:cy+Math.cos(ph)*rad*.82+Math.sin(time*.7+i)*R*.02,
          r:Math.max(1.4*dpr,R*.085),c:col,shell:false});
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
    const hue=poolHue(tickers.get(blk.p)||'',blk.p);
    push({x:cx,y:cy,r:R,c:hsl(hue,.7,.62),shell:true});
    inside(blk,cx,cy,R,time+blk.h*.37,dpr);
   }
   // The one being looked at, large enough to count what is in it.
   const fb=focusBox.current;
   if(fb&&shown){
    const r=fb.getBoundingClientRect();
    const cx=(r.left-b.left+r.width/2)*dpr,cy=(r.top-b.top+r.height/2)*dpr;
    const R=Math.min(r.width,r.height)/2*dpr*.86;
    const hue=poolHue(tickers.get(shown.p)||'',shown.p);
    push({x:cx,y:cy,r:R,c:hsl(hue,.72,.6),shell:true});
    inside(shown,cx,cy,R,time,dpr);
   }
   const n=buf.length/7;
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
      style={{'--blk-hue':`${Math.round(poolHue(tk,b.p)*360)}deg`} as React.CSSProperties}>
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
