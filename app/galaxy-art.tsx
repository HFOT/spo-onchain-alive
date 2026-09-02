'use client';
import {useEffect,useRef,useState} from 'react';

/* The whole network in one picture, and the way into any single pool.
   ------------------------------------------------------------------
   Every ranked pool is a star. How far out it orbits is set by how much
   stake it holds, so the heavy end of the network gathers at the middle
   the way mass does - that is the only reason the centre is bright, and it
   is a picture of where the stake sits rather than a verdict on anyone.
   Score sets brightness, the pool's own hue sets colour, and the number of
   delegators sets how much dust travels with the star, so the density of
   the disc is the number of people holding it up.

   The disc is not wallpaper. Wheel over it and it opens: past a certain
   magnification the stars stand far enough apart to carry their tickers, and
   a ticker is the way in to that pool alone. The turning slows as you go in,
   because by then you are reading rather than watching.

   Nothing is simulated. A star's orbit is analytic - fixed radius, angle as a
   function of time - so the vertex shader places it directly with no compute
   pass, and the same three lines of arithmetic run on the CPU for the handful
   of stars that need a label or a hit test. */

export type GalaxyPool={pool:string;ticker:string;hue:number;stake:number;delegators:number;score:number;
 /** The six axis scores as ratios, and the pool's stable signature - the same
     two things the pool's own artwork is drawn from. */
 axes:number[];sig:number[]};

const V=`#version 300 es
precision highp float;
in vec4 A;
in vec2 B;
uniform float T,ASPECT,NCORE,DPR,SPREAD,ZOOM;
uniform vec2 CAM,DISC;
out float HUE,BRIGHT;
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
void main(){
 float id=float(gl_VertexID),r=A.x;
 /* Inner orbits run faster, as they do under gravity. Without this the disc
    turns like a plate and reads as a texture rather than a thing in motion. */
 float th=A.y+T*(.055/sqrt(max(r,.07)));
 /* Two arms, kept as a brightness wave in a slowly turning frame rather than
    as positions. Arms written into positions wind themselves shut within a
    minute; a wave the stars pass through does not. */
 float arm=.5+.5*cos(2.*(th-2.2*log(max(r,.03))-T*.018));
 vec2 p=vec2(cos(th),sin(th))*r;
 p.y*=.46;                                  // the disc, seen from an angle
 p.y+=(h1(id*1.7)-.5)*.06*(1.-r*.6);        // and given some thickness
 /* The pool's own artwork, added after the tilt so each one faces us rather
    than lying flattened in the plate. This is the whole point of going in: a
    star turns out to be the same six-lobed figure the pool's own page draws,
    at the size its delegators earn it.

    The figure opens with the magnification, but slower than the magnification
    itself. A figure that grew in step with the zoom would spread its motes
    across the whole viewport within a few turns of the wheel and read as a
    scatter of unrelated dots; held back to the root of it, a pool is a speck
    far out and settles at a size its own crowd can actually fill in. */
 p+=B*(.6/pow(max(ZOOM,1.),.45));
 p=(p*SPREAD+DISC-CAM)*ZOOM;
 gl_Position=vec4(p.x,p.y*ASPECT,0.,1.);
 bool core=id<NCORE;
 BRIGHT=A.w*(.22+.78*arm)*(core?1.:.62);
 HUE=A.z;
 /* Motes grow with magnification, but far more slowly than the distances
    between them, so going in separates the crowd rather than magnifying a
    blur. Dust is drawn wide and faint: small hard motes stay separate specks
    and the disc reads as confetti, while wide faint ones overlap, and that
    overlap is what becomes the nucleus. */
 float g=1.+log2(max(ZOOM,1.))*.26;
 /* A sky has a huge range of apparent sizes in it. Everything drawn within a
    couple of pixels of everything else is what made this look like gravel, so
    brightness drives size hard for the stars and every mote gets its own
    scale on top. */
 float v=h1(id*3.7+11.);
 gl_PointSize=(core?2.4+A.w*A.w*7.:(1.+A.w*2.2)*(.55+1.15*v))*g*DPR;
}`;

const F=`#version 300 es
precision highp float;
in float HUE,BRIGHT;
out vec4 O;
vec3 pal(float h){vec3 p=abs(fract(h+vec3(0.,.666,.333))*6.-3.);return clamp(p-1.,0.,1.);}
void main(){
 float d=length(gl_PointCoord-.5);
 if(d>.5)discard;
 /* The pool's hue is a tint on starlight, not the whole colour. At full
    saturation 1,281 unrelated hues read as static; held to a tint they read as
    a population with variation in it, which is what it is. Warm hues are also
    let through a little more than cool ones, the way a sky separates. */
 vec3 t=pal(HUE);
 vec3 c=mix(vec3(.62,.74,1.),t,.2+.12*t.r);
 c=mix(c,vec3(.95,.97,1.),BRIGHT*.45);
 /* A power falloff, not a smoothstep. Two smoothsteps over three or four
    pixels quantise into a square with a hard rim, which is what made the
    zoomed-in field look like gravel; a tight core inside a wide faint glow is
    what a point of light actually does. */
 float core=pow(max(0.,1.-d*2.),7.),halo=pow(max(0.,1.-d*2.),2.);
 /* Premultiplied, and the alpha carries the same intensity as the colour.
    Writing a flat 1.0 saturates the canvas on the first mote and the additive
    pass has nothing left to add to - the disc goes out. Kept low per mote so
    that brightness is something the crowd earns together. */
 /* Enough of the sprite has to be lit. Nearly all the weight on a very tight
    core left each mote a single pixel inside a wide dark disc, and a cluster
    of them read as almost nothing. */
 float a=(core*.5+halo*.42)*(.1+BRIGHT*1.05);
 O=vec4(c*a,a);
}`;

function sh(gl:WebGL2RenderingContext,t:number,src:string){const s=gl.createShader(t)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s}
function prog(gl:WebGL2RenderingContext,v:string,f:string){const p=gl.createProgram()!;gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program');return p}
/** Stable per-pool randomness. A pool has to land in the same place every time
    the page is opened, so nothing here may come from Math.random.

    The pool id is hashed once and every mote's numbers are mixed out of that
    integer. Re-walking a 56-character bech32 string five times for each of two
    hundred thousand motes is a second of work before the first frame; mixing
    an integer is not. */
function seedOf(s:string){let x=2166136261;for(let i=0;i<s.length;i++)x=Math.imul(x^s.charCodeAt(i),16777619);return x>>>0}
function mix(seed:number,n:number){let x=Math.imul(seed^(n+0x9e3779b9),2654435761);x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;return(x>>>0)/4294967295}

/* Stake spans five orders of magnitude, so the radius comes off log10. The
   window is fixed rather than fitted to the day's data: a pool must not slide
   across the disc because some other pool grew. The exponent then spreads the
   band holding most of the network out across the plate - a monotonic remap of
   the same quantity, so more stake is still nearer the middle; it only changes
   how much room the crowd gets. */
const LO=4.5,HI=8.1;
const radiusOf=(stake:number)=>Math.pow(1-Math.min(1,Math.max(0,(Math.log10(Math.max(1e3,stake))-LO)/(HI-LO))),.62);
const TILT=.46;                     // how far the plate is turned away from us
const LABEL_ZOOM=2.2;               // magnification at which the tickers appear
const MAX_ZOOM=120,MAX_LABELS=26;

/** One star per pool, then the remaining budget spread as dust in proportion to
    delegators. Weighting by delegators alone would leave a third of the network
    on a single particle each and effectively invisible, which is the opposite
    of what this picture is for. */
/* Motes every pool gets, whatever its size, so that every figure can be made
   out rather than read as a scatter of unrelated dots. Six lobes need enough
   of a crowd to have a shape. */
const BASE=100;

/** The disc, built once.
    Each pool is placed on its orbit and then drawn there as its own artwork -
    the same six lobes, from the same six axis scores, that the pool's own page
    draws with. A pool's motes belong to that pool: scattering them around the
    orbit instead drew every crowded radius as a hard ring, and said something
    false besides, since those delegators are not spread across the network -
    they are at one operator.

    Every pool gets the same floor of motes so that no figure is too sparse to
    read; the rest of the budget is shared out by delegators, so a pool holding
    more people is a larger object. */
export function buildGalaxy(pools:GalaxyPool[],budget:number){
 const orbit:number[]=[],form:number[]=[],scales:number[]=[];
 const spare=Math.max(0,budget-pools.length);
 const base=Math.max(0,Math.min(BASE,Math.floor(spare/Math.max(1,pools.length))));
 const total=pools.reduce((a,p)=>a+Math.max(1,p.delegators),0)||1;
 const extra=spare-base*pools.length;
 // The stars themselves: one per pool, at the centre of its own figure.
 const seeds=pools.map(p=>seedOf(p.pool));
 pools.forEach((p,k)=>{
  orbit.push(radiusOf(p.stake),mix(seeds[k],1)*6.2832,p.hue,.3+.7*Math.min(1,p.score/100));
  form.push(0,0);
 });
 pools.forEach((p,k)=>{
  const sd=seeds[k],r=radiusOf(p.stake),ph=mix(sd,1)*6.2832,bright=.3+.7*Math.min(1,p.score/100);
  const n=base+Math.round(Math.max(1,p.delegators)/total*extra);
  const a=p.axes,rot=(p.sig[0]||0)*6.2832;
  // How big this pool's figure stands in the disc. More delegators, more room.
  const scale=.055*(.7+.6*Math.min(2.2,Math.sqrt(n)/13));
  scales.push(scale);
  for(let i=0;i<n;i++){
   /* The PARTICLE layout, exactly as the pool's own artwork lays it out: a
      mote is handed to one of the six axes and pushed out by that axis score,
      so a strong axis holds its crowd far out and a weak one lets it fall
      back to the middle. */
   const j=i*5;
   const sector=mix(sd,j+2)*6,i0=Math.floor(sector),fr=sector-i0,i1=(i0+1)%6;
   const sm=fr*fr*(3-2*fr),av=(a[i0]||0)*(1-sm)+(a[i1]||0)*sm;
   const ang=(i0+fr)*1.0472+(mix(sd,j+3)-.5)*.6+rot;
   const rr=(.09+av*.62*Math.pow(mix(sd,j+4),.55))*(.82+.36*mix(sd,j+5))*scale;
   orbit.push(r,ph,p.hue,bright);
   form.push(Math.cos(ang)*rr,Math.sin(ang)*rr*.92);
  }
 });
 return{data:Float32Array.from(orbit),off:Float32Array.from(form),scale:Float32Array.from(scales),
        count:orbit.length/4,cores:pools.length};
}

type Mark={pool:string;ticker:string;x:number;y:number};
/** The pool the disc has arrived at: which one, where it sits on screen, how
    much room its figure takes, and how far in the reader has come. */
export type Focus={pool:string;x:number;y:number;size:number;t:number};
const FOCUS_ZOOM=6;   // magnification at which the real artwork takes over

export default function GalaxyArt({pools,budget=60000,onPick,onFocus,disc=[.24,-.06],avoid}:{
 pools:GalaxyPool[];budget?:number;onPick?:(pool:string)=>void;
 /** Fires when the disc settles on a pool, so the page can draw that pool's
     real artwork in its place. */
 onFocus?:(f:Focus|null)=>void;disc?:number[];
 /** The copy column. Tickers keep out of it: a name landing on a sentence is
     unreadable and the sentence is worse for it. */
 avoid?:React.RefObject<HTMLElement|null>;
}){
 const ref=useRef<HTMLCanvasElement>(null);
 const reset=useRef<(()=>void)|null>(null);
 const pick=useRef(onPick);
 useEffect(()=>{pick.current=onPick},[onPick]);
 const focus=useRef(onFocus);
 useEffect(()=>{focus.current=onFocus},[onFocus]);
 const [marks,setMarks]=useState<Mark[]>([]);
 const [hover,setHover]=useState<Mark|null>(null);
 const [zoom,setZoom]=useState(1);
 const dx=disc[0],dy=disc[1];

 useEffect(()=>{
  const c=ref.current;
  if(!c||!pools.length)return;
  const gl=c.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true});
  // No WebGL2 means no canvas worth keeping. The flag lets the stylesheet fall
  // back to a still night sky rather than leaving a blank rectangle.
  if(!gl){c.dataset.fallback='true';return}
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const {data,off,scale,count,cores}=buildGalaxy(pools,budget);
  const p=prog(gl,V,F),vao=gl.createVertexArray(),buf=gl.createBuffer(),obuf=gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(p,'A');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,obuf);
  gl.bufferData(gl.ARRAY_BUFFER,off,gl.STATIC_DRAW);
  const oloc=gl.getAttribLocation(p,'B');
  gl.enableVertexAttribArray(oloc);
  gl.vertexAttribPointer(oloc,2,gl.FLOAT,false,0,0);
  const u=(n:string)=>gl.getUniformLocation(p,n);
  const byStake=pools.map((_,i)=>i).sort((a,b)=>pools[b].stake-pools[a].stake);
  /* Where the disc puts what the reader has come to look at. Not the middle of
     the frame - the copy holds one side of it, and a pool delivered there
     would arrive underneath a paragraph. */
  const eye=()=>{
   const b=c.getBoundingClientRect(),av=avoid?.current?.getBoundingClientRect();
   const k=dpr(),left=av?Math.min(W-40*k,(av.right-b.left+24)*k):0;
   return[(left+W)/2,H/2];
  };
  const dpr=()=>Math.min(devicePixelRatio||1,2);

  // View state. `cam` is the world point held at the centre of the frame and
  // `zm` the magnification; together they are the only thing the wheel touches.
  let raf=0,last=0,sim=0,zm=1,cam=[0,0],spread=1,aspect=1,W=1,H=1,labelAt=0,shown=0;
  const hoverRef:{pool:string|null}={pool:null},focusRef:{pool:string|null}={pool:null};

  /* The same arithmetic as the vertex shader, for one star. Kept here rather
     than read back from the GPU because only a couple of dozen stars ever need
     a screen position - the ones being labelled or hit-tested. */
  const starWorld=(i:number)=>{
   const r=data[i*4],ph=data[i*4+1];
   const th=ph+sim*(.055/Math.sqrt(Math.max(r,.07)));
   return[Math.cos(th)*r*spread+dx,Math.sin(th)*r*TILT*spread+dy];
  };
  const starAt=(i:number)=>{
   const[wx,wy]=starWorld(i);
   const vx=(wx-cam[0])*zm,vy=(wy-cam[1])*zm;
   return[(vx*.5+.5)*W,(1-(vy*aspect*.5+.5))*H];
  };
  // Screen point to world point, so the wheel can hold whatever is under the
  // cursor still while the magnification changes around it.
  const toWorld=(sx:number,sy:number)=>[(sx/W*2-1)/zm+cam[0],((1-sy/H*2)/aspect)/zm+cam[1]];
  const nearest=(sx:number,sy:number,within:number)=>{
   let best=-1,bd=within*within;
   for(let i=0;i<cores;i++){
    const[x,y]=starAt(i),ax=x-sx,ay=y-sy,d=ax*ax+ay*ay;
    if(d<bd){bd=d;best=i}
   }
   return best;
  };
  /* Which stars stand far enough apart to be told apart, and are therefore
     worth naming. Biggest stake first, and a label is only kept if it does not
     land on one already placed. */
  const relabel=()=>{
   if(zm<LABEL_ZOOM){if(shown){shown=0;setMarks([])}return}
   const out:Mark[]=[],taken:number[][]=[],k=dpr(),b=c.getBoundingClientRect();
   const av=avoid?.current?.getBoundingClientRect();
   // In canvas pixels, the rectangle the copy occupies, with a margin.
   const ax=av?(av.right-b.left+18)*k:0,ay0=av?(av.top-b.top-12)*k:0,ay1=av?(av.bottom-b.top+12)*k:0;
   for(const i of byStake){
    const[x,y]=starAt(i);
    // A ticker sits to the right of its star, so the right edge needs the room
    // for it or the name is cut in half by the frame.
    if(x<14*k||y<16*k||x>W-96*k||y>H-16*k)continue;
    if(av&&x<ax&&y>ay0&&y<ay1)continue;
    const tk=pools[i].ticker;
    // A blank field, or the placeholder the ranking writes into one, names
    // nothing - and a box with nothing in it reads as a broken label.
    if(!tk||tk==='N/A')continue;
    if(taken.some(t=>Math.abs(t[0]-x)<108*k&&Math.abs(t[1]-y)<22*k))continue;
    taken.push([x,y]);
    out.push({pool:pools[i].pool,ticker:tk,x:x/k,y:y/k});
    if(out.length>=MAX_LABELS)break;
   }
   shown=out.length;setMarks(out);
  };

  /* Which pool the reader has arrived at. The magnetic pull puts it at the
     middle of the frame, so that is where to look for it; the page draws the
     pool's own artwork there and the disc stops having to pretend it can. */
  const refocus=()=>{
   const k=dpr();
   if(zm<FOCUS_ZOOM){if(focusRef.pool){focusRef.pool=null;focus.current?.(null)}return}
   const[fx,fy]=eye();
   let best=-1,bd=(Math.min(W,H)*.34)**2;
   for(let i=0;i<cores;i++){
    const[x,y]=starAt(i),ax=x-fx,ay=y-fy,d=ax*ax+ay*ay;
    if(d<bd){bd=d;best=i}
   }
   if(best<0){if(focusRef.pool){focusRef.pool=null;focus.current?.(null)}return}
   const[x,y]=starAt(best);
   // The room the pool's own figure takes on screen, so the artwork arrives at
   // the size the disc had promised it rather than at some fixed square.
   const size=Math.max(250,Math.min(660,scale[best]*.838*(.6/Math.pow(zm,.45))*spread*(W/2)*zm/k*3.2));
   focusRef.pool=pools[best].pool;
   focus.current?.({pool:pools[best].pool,x:x/k,y:y/k,size,
    t:Math.min(1,(zm-FOCUS_ZOOM)/(FOCUS_ZOOM*.9))});
  };

  const draw=(now:number)=>{
   const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
   // Going in slows the turning. Past the point where the tickers appear the
   // reader is aiming at something, and a moving target is a worse one.
   if(!still)sim+=dt/(1+(zm-1)*.9);
   const k=dpr(),b=c.getBoundingClientRect();
   W=Math.max(2,Math.floor(b.width*k));H=Math.max(2,Math.floor(b.height*k));
   if(c.width!==W||c.height!==H){c.width=W;c.height=H}
   aspect=W/H;
   // A wide viewport gets a wider disc, so the galaxy fills the frame instead
   // of sitting in it as a medallion.
   spread=Math.min(1.6,Math.max(1,aspect*.62));
   gl.viewport(0,0,W,H);
   gl.clearColor(0,0,0,0);
   gl.clear(gl.COLOR_BUFFER_BIT);
   gl.enable(gl.BLEND);
   // Additive, so overlapping stars pile into light instead of painting over
   // one another. It is what makes the centre burn.
   gl.blendFunc(gl.ONE,gl.ONE);
   gl.useProgram(p);
   gl.bindVertexArray(vao);
   gl.uniform1f(u('T'),still?18:sim);
   gl.uniform1f(u('ASPECT'),aspect);
   gl.uniform1f(u('NCORE'),cores);
   gl.uniform1f(u('DPR'),k);
   gl.uniform1f(u('SPREAD'),spread);
   gl.uniform1f(u('ZOOM'),zm);
   gl.uniform2f(u('CAM'),cam[0],cam[1]);
   gl.uniform2f(u('DISC'),dx,dy);
   gl.drawArrays(gl.POINTS,0,count);
   if(now-labelAt>110){labelAt=now;relabel();refocus()}
   raf=requestAnimationFrame(draw);
  };

  const home=()=>{zm=1;cam=[0,0];setZoom(1)};
  reset.current=home;

  const wheel=(e:WheelEvent)=>{
   /* At rest the disc lets the page past it, so nobody is trapped inside a
      canvas they cannot scroll off. Once the reader has gone in, the wheel
      belongs to the disc until they have come all the way back out. */
   if(zm<=1.001&&e.deltaY>0)return;
   e.preventDefault();
   const k=dpr(),b=c.getBoundingClientRect();
   const sx=(e.clientX-b.left)*k,sy=(e.clientY-b.top)*k;
   const[wx,wy]=toWorld(sx,sy);
   const going=e.deltaY<0;
   zm=Math.min(MAX_ZOOM,Math.max(1,zm*Math.exp(-e.deltaY*.0016)));
   if(zm<=1.001){home();return}
   cam=[wx-(sx/W*2-1)/zm,wy-((1-sy/H*2)/aspect)/zm];
   /* Going in pulls toward whichever pool is nearest the cursor. Without it
      the reader lands in the gaps - most of a disc is the space between its
      objects - and works the wheel without ever arriving at anything. The
      pull only strengthens with magnification, so at low zoom the wheel still
      goes exactly where it is pointed. */
   if(going&&zm>2){
    const i=nearest(sx,sy,Math.min(W,H)*.32);
    if(i>=0){
     // Bring it to the reading side of the frame, not to the middle.
     const[wx2,wy2]=starWorld(i),[fx,fy]=eye();
     const tx=wx2-(fx/W*2-1)/zm,ty=wy2-((1-fy/H*2)/aspect)/zm;
     const t=Math.min(.55,(zm-2)/12);
     cam=[cam[0]+(tx-cam[0])*t,cam[1]+(ty-cam[1])*t];
    }
   }
   setZoom(zm)
  };
  const move=(e:PointerEvent)=>{
   const k=dpr(),b=c.getBoundingClientRect();
   const i=nearest((e.clientX-b.left)*k,(e.clientY-b.top)*k,16*k);
   c.style.cursor=i>=0?'pointer':'crosshair';
   // Naming what is under the cursor works at any magnification, so the disc
   // answers before the reader has committed to going into it.
   const t=i<0?null:pools[i];
   if((t?.pool||null)!==(hoverRef.pool||null)){
    hoverRef.pool=t?.pool||null;
    const[x,y]=i<0?[0,0]:starAt(i);
    setHover(t?{pool:t.pool,ticker:t.ticker||t.pool.slice(0,10)+'…',x:x/k,y:y/k}:null);
   }
  };
  const click=(e:PointerEvent)=>{
   const k=dpr(),b=c.getBoundingClientRect();
   const i=nearest((e.clientX-b.left)*k,(e.clientY-b.top)*k,16*k);
   if(i>=0)pick.current?.(pools[i].pool);
  };
  c.addEventListener('wheel',wheel,{passive:false});
  c.addEventListener('pointermove',move,{passive:true});
  c.addEventListener('click',click);
  raf=requestAnimationFrame(draw);
  return()=>{
   cancelAnimationFrame(raf);
   c.removeEventListener('wheel',wheel);
   c.removeEventListener('pointermove',move);
   c.removeEventListener('click',click);
   gl.deleteBuffer(buf);gl.deleteBuffer(obuf);gl.deleteVertexArray(vao);gl.deleteProgram(p);
  };
 },[pools,budget,dx,dy,avoid]);
 useEffect(()=>()=>focus.current?.(null),[]);

 return <div className="galaxy-stage">
  <canvas ref={ref} className="galaxy-art"/>
  <div className="galaxy-marks">
   {marks.map(m=><button key={m.pool} type="button" style={{left:m.x,top:m.y}}
     onClick={()=>pick.current?.(m.pool)}>{m.ticker}</button>)}
   {hover&&!marks.some(m=>m.pool===hover.pool)&&
    <button className="on" type="button" style={{left:hover.x,top:hover.y}}
     onClick={()=>pick.current?.(hover.pool)}>{hover.ticker}</button>}
  </div>
  {zoom>1.001&&<button className="galaxy-reset" type="button" onClick={()=>reset.current?.()}>
   ×{zoom<10?zoom.toFixed(1):Math.round(zoom)} · RESET</button>}
 </div>;
}
