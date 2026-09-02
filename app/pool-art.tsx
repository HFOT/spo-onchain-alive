'use client';
import {useEffect,useRef} from 'react';

// Non-particle renderings of the same relay-health axis data. Motif 0 (particles)
// stays on WebGL in BlockArt; these are Canvas 2D.
//
// Every mode runs the SAME emergent simulation the particle view runs: a few
// hundred agents, each following simple local rules bent by the six axes. No
// mode places a node, an edge, a ring or a curve in advance — the form is only
// ever what the motion happens to be making right now.
//
// The canvas is cleared every frame, exactly like the particle view. Nothing
// accumulates: no trails, no residue, no painted ground. A line is not a record
// of where an agent has been — it is the streamline the agent is sitting on at
// this instant, integrated a few steps forward through the same field that
// moves it. So the art stays fluid and the background stays untouched.
//
// The axes set how STRONG each direction is; `sig`, hashed from the pool id,
// sets the STRUCTURE — symmetry count, twist, curl scale, aspect, spin, and the
// harmonic ratios of the voice. Without it every pool would draw the same
// silhouette in a different colour.

export type ArtData={
 axes:number[];        // six relay-health axes, each normalised 0..1
 hueBase:number;       // 0..1, derived from the pool ticker
 histVar:number;       // volatility of the stake history
 speedMul:number;      // derived from RTT: low latency animates faster
 warnAxes:number[];    // axes carrying a shared-infrastructure flag
 hist:number[];        // stake history samples
 ticker:string;
 score:number;
 sig:number[];         // six stable 0..1 numbers hashed from the pool id
};

// Same analogous offsets the particle shader uses, so a pool keeps one colour family.
const AXIS_OFFSET=[-.11,-.055,.02,.075,-.15,.135];
const WARN_HUE=22;
const TAU=Math.PI*2;

function axisCss(d:ArtData,i:number,light:number,alpha:number,sat=70){
 if(d.warnAxes.includes(i))return`hsl(${WARN_HUE} 88% ${light}% / ${alpha})`;
 return`hsl(${((d.hueBase+AXIS_OFFSET[i])%1+1)%1*360} ${sat}% ${light}% / ${alpha})`;
}
function rnd(n:number){const v=Math.sin(n*127.1+11.7)*43758.5453;return v-Math.floor(v)}

/** The pool's structural fingerprint, read straight off `sig`. */
function shape(d:ArtData){
 const s=d.sig;
 return{
  rot:s[0]*TAU,                    // where the form is oriented
  lobes:3+Math.floor(s[1]*7),      // 3..9 fold symmetry
  twist:(s[2]-.5)*2.4,             // spiral shear
  curl:1.4+s[3]*3.8,               // turbulence scale
  aspect:.74+s[4]*.46,             // vertical squash
  spin:s[5]<.5?-1:1,               // direction of rotation
  // RTT alone leaves most pools moving at the same pace; give each its own
  // tempo so the speed reads as part of its identity.
  tempo:.5+((s[0]*1.7+s[3]*2.3)%1)*1.6,
 };
}

/** Pick an axis, favouring strong ones, so healthy axes own more of the frame. */
function pickAxis(d:ArtData,r:number){
 const w=d.axes.map(v=>.05+v);
 const total=w.reduce((a,b)=>a+b,0);
 let acc=0;
 for(let i=0;i<6;i++){acc+=w[i]/total;if(r<=acc)return i}
 return 5;
}

/** Each axis owns its own shell, spaced out from the centre, and its score
    stretches or collapses that shell. Spacing has to come from the axis index
    rather than the score alone, or a pool that scores full marks everywhere
    would stack all six rings on the same radius and read as a single band. */
function ringRadius(d:ArtData,a:number){
 const spacing=.15+a*.115;
 return spacing*(.55+d.axes[a]*.75);
}

type Agent={
 x:number;y:number;   // position in canvas pixels
 vx:number;vy:number;
 a:number;            // which axis this agent belongs to (drives colour and target)
 seed:number;
 age:number;life:number;
 w:number;
 u:number;            // free per-agent parameter; modes use it as a phase
 light:number;        // shading from the local slope, for modes that need relief
};

type Mode={
 count:number;
 /** How many steps of the field to trace ahead of each agent. This is what
     gives a line its length; it is read forward from the present, never from
     the past, so clearing the canvas costs nothing. */
 streak:number;
 /** How an agent leaves the frame. */
 wrap:'radial'|'scroll';
 seed(ag:Agent,d:ArtData,W:number,H:number):void;
 force(ag:Agent,d:ArtData,t:number,nx:number,ny:number):[number,number];
 /** Optional: replace the streak renderer entirely. */
 draw?(c:CanvasRenderingContext2D,ags:Agent[],d:ArtData,t:number,R:number,cx:number,cy:number):void;
 /** Ink for one agent's streak: a wide faint halo and a thin bright core, so
     the stroke reads as light rather than as a drawn line. `pulse` is the
     travelling brightness wave passed in by the renderer. */
 ink(d:ArtData,ag:Agent,pulse:number):{core:string;halo:string;width:number};
};

/* ---------------------------------------------------------------- LINE ----
   Flow-field ink. Each agent renders the streamline it is riding right now, so
   the frame is full of curves without a single one being a leftover. Symmetry,
   twist and curl come from the pool, so one pool's filaments braid quite
   differently from another's. */
const LINE:Mode={
 count:880,streak:0,wrap:'radial',
 seed(ag,d){
  const sh=shape(d);
  ag.a=pickAxis(d,rnd(ag.seed*7.3));
  const ang=sh.rot+ag.a*TAU/6+(rnd(ag.seed*3.1)-.5)*1.1;
  const r=(.05+rnd(ag.seed*5.7)*.32)*(.5+d.axes[ag.a]);
  ag.x=Math.cos(ang)*r;ag.y=Math.sin(ang)*r*sh.aspect;
  ag.life=110+rnd(ag.seed*2.3)*280;
  ag.w=.3+rnd(ag.seed*9.1)*1.1;
 },
 force(ag,d,t,nx,ny){
  const sh=shape(d),v=d.axes[ag.a];
  const time=t*.0016*d.speedMul*sh.tempo*sh.spin;
  const rad=Math.hypot(nx,ny);
  const theta=Math.atan2(ny,nx);
  let ang=Math.sin(ny*sh.curl+time)*1.5+Math.cos(nx*sh.curl*.88-time*.8)*1.5;
  const own=sh.rot+ag.a*TAU/6;
  ang+=Math.sin((nx*Math.cos(own)+ny*Math.sin(own))*sh.curl*1.3+time*.6)*1.1;
  ang+=sh.twist*rad;                                   // shear into a spiral
  const petal=1+.34*Math.sin(sh.lobes*theta+sh.rot);   // reach rises and falls
  const outward=own+Math.sin(rad*5.2+time)*.5;
  const pull=(v*.85*petal-rad)*1.9;
  return[
   Math.cos(ang)*.62+Math.cos(outward)*pull,
   (Math.sin(ang)*.62+Math.sin(outward)*pull)*sh.aspect
  ];
 },
 ink(d,ag,pulse){
  const v=d.axes[ag.a],a=(.05+v*.15)*pulse;
  return{
   core:axisCss(d,ag.a,66+v*26,a),
   halo:axisCss(d,ag.a,50+v*24,a*.42),
   width:ag.w*(.22+v*.36)
  };
 },
 // Agents are chained in sequence and every frame the current link between each
 // consecutive pair is drawn. Nothing is a streamline here: what you see is the
 // connection itself, stretching and bending as the flow carries the ends apart,
 // with light running down the chain link by link.
 draw(c,ags,d,t,R,cx,cy){
  const CHAIN=11,sh=shape(d);
  c.lineCap='round';c.lineJoin='round';
  for(let i=0;i<ags.length-1;i++){
   if(i%CHAIN===CHAIN-1)continue;            // break between chains
   const a=ags[i],b=ags[i+1];
   const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
   if(dist>R*.52)continue;                   // a link that stretched too far snaps
   const slack=1-dist/(R*.52);
   const link=i%CHAIN;
   // A pulse travels along the chain, so the connection reads as carrying signal.
   const pulse=.18+.82*(.5+.5*Math.sin(link*.85-t*.055*d.speedMul*sh.tempo+Math.floor(i/CHAIN)*1.3));
   const v=Math.min(d.axes[a.a],d.axes[b.a]);
   const alpha=(.05+v*.24)*slack*pulse;
   const w=(.22+v*.5)*(.5+slack);
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
   c.strokeStyle=axisCss(d,a.a,48+v*24,alpha*.4);
   c.lineWidth=w*5.5;c.stroke();             // bloom
   c.strokeStyle=axisCss(d,a.a,68+v*26,alpha);
   c.lineWidth=w;c.stroke();                 // filament
  }
 }
};

/* ----------------------------------------------------------- STRUCTURE ----
   Drops. A light appears somewhere on the surface and fine concentric rings open
   out of it, many layers deep, softening as they go. Each drop runs on its own
   clock, so the events overlap at staggered times and the surface is never doing
   the same thing twice. Ring spacing, expansion speed, how long a drop lives and
   how often it falls are all the pool's. */
const STRUCTURE:Mode=(()=>{
 return{
  count:11,streak:0,wrap:'radial',
  seed(ag,d){
   ag.a=pickAxis(d,rnd(ag.seed*4.1));   // axis picks the colour
   ag.u=rnd(ag.seed*9.4);               // offset in the cycle, so drops stagger
   ag.x=0;ag.y=0;
   ag.life=1e9;
   ag.w=.5+rnd(ag.seed*3.3)*.9;         // strength of this drop
  },
  // Drops do not travel; the rings do. Their lifecycle is run in draw().
  force(){return[0,0]},
  ink(d,ag,pulse){
   const v=d.axes[ag.a];
   return{core:axisCss(d,ag.a,70,.3*pulse),halo:axisCss(d,ag.a,54,.1*pulse),width:.6+v*.5};
  },
  draw(c,ags,d,t,R,cx,cy){
   const sh=shape(d);
   const period=300+d.sig[1]*380;                 // frames from one drop to its next
   const expand=R*(.0055+d.sig[3]*.0065)*d.speedMul*sh.tempo;   // how fast rings open
   const gap=R*(.030+d.sig[2]*.055);              // spacing between rings
   const rings=9+Math.floor(d.sig[4]*9);          // how many layers deep
   const maxR=R*1.12;
   c.lineCap='round';
   for(const ag of ags){
    const clock=t*sh.tempo+ag.u*period;
    const age=((clock%period)+period)%period;
    const cycle=Math.floor(clock/period);
    // A fresh position each time this drop falls again.
    const s1=rnd(ag.seed*3.1+cycle*7.7),s2=rnd(ag.seed*5.3+cycle*11.3);
    const ang=s1*TAU,rad=Math.sqrt(s2)*R*.62;
    const ox=cx+Math.cos(ang)*rad,oy=cy+Math.sin(ang)*rad*sh.aspect;
    const v=d.axes[ag.a];
    const fade=1-age/period;                      // the whole event dies away
    if(fade<=0)continue;
    // The flash at the moment of impact.
    if(age<26){
     const f=1-age/26;
     c.beginPath();c.arc(ox,oy,1.2+f*3.4*ag.w,0,TAU);
     c.fillStyle=axisCss(d,ag.a,86,.5*f*f*ag.w);
     c.fill();
    }
    // Concentric rings, the outermost being the oldest.
    for(let k=0;k<rings;k++){
     const r=age*expand-k*gap;
     if(r<=1||r>maxR)continue;
     const depth=1-k/rings;                       // inner rings are the youngest
     const soft=Math.min(1,r/(R*.14));            // ease in as it leaves the centre
     const a=(.055+v*.14)*fade*fade*depth*soft*ag.w;
     if(a<.004)continue;
     c.beginPath();
     c.ellipse(ox,oy,r,r*sh.aspect,sh.rot,0,TAU);
     c.strokeStyle=axisCss(d,ag.a,52+v*18,a*.34);
     c.lineWidth=(.5+v*.5)*2.6;c.stroke();        // the soft edge of the ring
     c.strokeStyle=axisCss(d,ag.a,70+v*20,a);
     c.lineWidth=.45+v*.5;c.stroke();             // the crisp crest
    }
   }
  }
 };
})();

/* --------------------------------------------------------------- ORBIT ----
   Nested shells. Each axis owns one orbit whose radius is its score, and every
   agent is only ever pulled toward that radius — the rings are never drawn as
   circles, they are what a crowd of arcs adds up to in the current frame.
   Eccentricity, tilt and precession are the pool's. */
const ORBIT:Mode={
 count:980,streak:21,wrap:'radial',
 seed(ag,d){
  const sh=shape(d);
  ag.a=pickAxis(d,rnd(ag.seed*4.9));
  ag.u=rnd(ag.seed*8.3)*TAU;                    // position along its orbit
  const r=ringRadius(d,ag.a);
  ag.x=Math.cos(ag.u)*r;ag.y=Math.sin(ag.u)*r*sh.aspect;
  ag.life=1e9;
  ag.w=.3+rnd(ag.seed*6.7)*.9;
 },
 force(ag,d,t,nx,ny){
  const sh=shape(d),v=d.axes[ag.a];
  const time=t*.0013*d.speedMul*sh.tempo*sh.spin;
  const rad=Math.hypot(nx,ny)||1e-4;
  const theta=Math.atan2(ny,nx);
  const tilt=sh.rot+ag.a*.42+time*(.25+ag.a*.08);   // each ring precesses
  const ecc=.16+d.sig[2]*.5;
  // A stiff spring would snap every agent onto the identical curve and the ring
  // would settle into one thin static line. Give each agent its own offset and
  // let the shell breathe, so the ring keeps thickness and never stops moving.
  const bias=(rnd(ag.seed*11.3)-.5)*.13;
  const breathe=1+.14*Math.sin(time*1.7+ag.seed*3.1)+.07*Math.sin(time*3.3+ag.a);
  const want=ringRadius(d,ag.a)*(1+ecc*Math.cos(2*(theta-tilt)))*breathe+bias;
  const radial=(want-rad)*1.35;                     // loose, so it orbits and drifts
  const swirl=Math.sin(theta*sh.lobes+time*2.1+ag.seed)*.22;
  const tangent=(.85+v*.5)*sh.spin+swirl;
  const ux=nx/rad,uy=ny/rad;
  return[ux*radial-uy*tangent,(uy*radial+ux*tangent)*sh.aspect];
 },
 ink(d,ag,pulse){
  const v=d.axes[ag.a],a=(.045+v*.135)*pulse;
  return{
   core:axisCss(d,ag.a,64+v*28,a),
   halo:axisCss(d,ag.a,48+v*24,a*.44),
   width:ag.w*(.20+v*.34)
  };
 }
};

/* --------------------------------------------------------------- VOICE ----
   A vector scope, the way an oscilloscope in XY mode draws a sound. Both axes
   are driven, so the pool's signal closes into a figure rather than scrolling
   past. The six relay-health axes are the harmonics and `sig` sets their
   frequency ratios and phases, which is what makes one pool's voice look
   nothing like another's: near-integer ratios close into calm knots, detuned
   ones wander into dense rosettes. */
const VOICE:Mode={
 count:80,streak:0,wrap:'radial',
 seed(ag,d){
  ag.a=pickAxis(d,rnd(ag.seed*6.7));
  ag.u=rnd(ag.seed*3.9);          // this trace's own phase offset
  ag.x=0;ag.y=0;
  ag.life=1e9;
  ag.w=.25+rnd(ag.seed*5.9)*1.0;  // its amplitude
 },
 // The agents are the traces, not points in a field; the sweep below is what
 // you see. Kept so the crowd still has its own phases and amplitudes.
 force(){return[0,0]},
 ink(d,ag,pulse){
  const v=d.axes[ag.a],a=(.05+v*.16)*pulse;
  return{
   core:axisCss(d,ag.a,66+v*26,a),
   halo:axisCss(d,ag.a,50+v*24,a*.4),
   width:.4+v*.5
  };
 },
 draw(c,ags,d,t,R,cx,cy){
  const s=d.sig,sh=shape(d);
  const time=t*.012*d.speedMul*sh.tempo;
  const left=cx-R*1.02,right=cx+R*1.02,span=right-left;
  // Harmonic ratios and phases are the pool's, so one voice is a slow swell and
  // another a tight buzz.
  const ratio=[1,2,3,4,5,6].map((n,i)=>n*(1+(s[i%6]-.5)*.5));
  const wave=(p:number,off:number)=>{
   let sum=0,norm=0;
   for(let i=0;i<6;i++){
    const v=d.axes[i];if(v<=0)continue;
    sum+=Math.sin(p*ratio[i]*TAU+time*(1+i*.16)+off*TAU+i*.9)*v;
    norm+=v;
   }
   return norm?sum/norm:0;
  };
  // Taper at both ends so the signal enters and leaves rather than being cut.
  const env=(p:number)=>Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,p))),.75);
  const N=88;
  c.lineCap='round';c.lineJoin='round';
  for(const ag of ags){
   const amp=R*.62*ag.w*sh.aspect;
   const yoff=(rnd(ag.seed*13.7)-.5)*R*.10;
   const pulse=.3+.7*(.5+.5*Math.sin(ag.seed*2.1-t*.045*d.speedMul*sh.tempo));
   const{core,halo,width}=this.ink(d,ag,pulse);
   const pt=(k:number):[number,number]=>{
    const p=k/N;
    return[left+p*span,cy+yoff+wave(p,ag.u)*amp*env(p)];
   };
   c.beginPath();
   for(let k=0;k<=N;k++){const[x,y]=pt(k);k?c.lineTo(x,y):c.moveTo(x,y)}
   c.strokeStyle=halo;c.lineWidth=width*5;c.stroke();
   c.strokeStyle=core;c.lineWidth=width;c.stroke();
   // A crest of light running left to right along the trace.
   const head=((t*.006*d.speedMul*sh.tempo+ag.u)%1)*N;
   c.beginPath();
   for(let k=Math.max(0,Math.floor(head)-7);k<=Math.min(N,Math.floor(head)+7);k++){
    const[x,y]=pt(k);k===Math.max(0,Math.floor(head)-7)?c.moveTo(x,y):c.lineTo(x,y);
   }
   const v=d.axes[ag.a];
   c.strokeStyle=axisCss(d,ag.a,54+v*24,.16);
   c.lineWidth=width*7;c.stroke();
   c.strokeStyle=axisCss(d,ag.a,82,.5);
   c.lineWidth=width*1.4;c.stroke();
  }
 }
};

/* --------------------------------------------------------------- CREST ----
   A kamon, built the way kamon are actually built.
   Japanese family crests are compass-and-brush work: there is no freehand curve
   in one. Every element is a circle or an arc of a circle, the field is divided
   into three, four, five, six or eight (seven and nine are all but unknown in
   the tradition), and the whole thing is closed inside a ring — the "maru ni"
   that names most crests. Petals are not drawn as shapes; they are the lens left
   where two compass circles overlap. Negative space carries as much weight as
   ink, so the marks stay flat and open rather than glowing.

   So the pool does not choose a picture here — it sets the compass. The six axes
   are the settings: how far an arc reaches, how wide it opens, how deep the waist
   is cut, how big the hub is. The pool id picks the division and the family, the
   ticker gives the ink its colour, the score gives the ring its weight, and a
   raised flag cuts the ring open. An emblem should be recognisable, so it holds
   still and only breathes. */
const DIVISIONS=[1,2,3,4,5,6,8,12];           // the divisions the tradition uses
const DIV_KANJI=['一つ','二つ','三つ','四つ','五つ','六つ','八つ','十二'];
// Kamon are overwhelmingly drawn from nature — plants, birds, shells, feathers —
// so the families here are natural subjects, not abstract ornament.
const FAMILY_KANJI=['花','木瓜','巴','星','桜','銀杏','鷹の羽','亀甲'];
// The ring is its own vocabulary in the tradition, not just a circle: it comes
// thick or thin, cornered, or inverted so the subject is knocked out of a solid
// disc. The name of a crest always states which ring it wears.
type Ring={ja:string;romaji:string;w:number;sides?:number;negative?:boolean;bare?:boolean};
const RINGS:Ring[]=[
 {ja:'丸に',romaji:'maru ni',w:1},
 {ja:'太丸に',romaji:'futomaru ni',w:1.9},
 {ja:'中輪に',romaji:'chūwa ni',w:.74},
 {ja:'細輪に',romaji:'hosowa ni',w:.46},
 {ja:'糸輪に',romaji:'ito-wa ni',w:.26},
 {ja:'八角井筒に',romaji:'hakkaku-izutsu ni',w:.9,sides:8},
 {ja:'亀甲に',romaji:'kikkō ni',w:.9,sides:6},
 {ja:'石持地抜きの',romaji:'kokumochi-jinuki no',w:0,negative:true},
 {ja:'',romaji:'',w:0,bare:true},
];
const DIV_ROMAJI=['hitotsu','futatsu','mitsu','yotsu','itsutsu','mutsu','yatsu','jūni'];
const FAMILY_ROMAJI=['hana','mokkō','tomoe','hoshi','sakura','ichō','taka-no-ha','kikkō'];
/** What the subject stands for. Kamon are not decoration: each family carries a
    wish, and the tradition is explicit about which. */
const FAMILY_MEANING_JA=[
 '花菱。花は繁栄と美の象徴で、公家の装束に始まり広く用いられました。',
 '木瓜。鳥の巣に由来し、子孫繁栄を願う紋。五大紋のひとつです。',
 '巴。水の渦を象り、火除けの護符とされ、八幡神の神紋として武家に好まれました。',
 '星。北極星を仰ぐ妙見信仰に由来し、進むべき方角を見失わないことを願います。',
 '桜。咲いて潔く散る姿に、日本人が最も心を寄せてきた花です。',
 '銀杏。火に強く長寿の木として、火伏せと長命を願う紋です。',
 '鷹の羽。鷹の勇猛にあやかる武家の紋で、日本で最も多く使われた紋のひとつです。',
 '亀甲。鶴は千年亀は万年。堅い甲羅に長寿と守りを託した紋です。',
];
const FAMILY_MEANING_EN=[
 'Hanabishi, the flower: prosperity and beauty, first worn by the court.',
 'Mokkō, said to be the nest of a bird — a wish for descendants. One of the five great crests.',
 'Tomoe, a whirl of water, carried as a charm against fire and taken up by warriors as the emblem of Hachiman.',
 'Hoshi, the pole star of the Myōken faith: a wish never to lose your bearing.',
 'Sakura, the cherry — the flower Japan loves most, for blooming and falling without clinging.',
 'Ichō, the ginkgo: a tree that resists fire and lives long, so a wish for both.',
 'Taka-no-ha, hawk feathers, borrowed from the valour of the bird and among the most worn crests in Japan.',
 'Kikkō, the tortoise shell: the crane lives a thousand years, the tortoise ten thousand — long life, and a hard shell around it.',
];
export function crestMeaning(sig:number[],lang:'ja'|'en'){
 const fam=Math.floor(sig[0]*8)%8;
 return(lang==='ja'?FAMILY_MEANING_JA:FAMILY_MEANING_EN)[fam];
}

/** The same name, read aloud. */
export function crestRomaji(sig:number[]){
 const fam=Math.floor(sig[0]*8)%8;
 const{ring,kage}=crestStyle(sig);
 const comp=crestComp(sig);
 const k=kage?'kage ':'';
 const head=ring.romaji?`${ring.romaji} `:'';
 if(fam===7)return`${head}${k}kikkō`.trim();
 const sub=crestSub(sig);
 const tail=sub.where==='none'?'':` ni ${SUB_ROMAJI[sub.fam]}`;
 const div=DIV_ROMAJI[Math.floor(sig[1]*DIVISIONS.length)%DIVISIONS.length];
 const body=comp.key!=='radial'
  ?`${head}${k}${comp.romaji} ${FAMILY_ROMAJI[fam]}`
  :`${head}${k}${div} ${FAMILY_ROMAJI[fam]}`;
 return`${body}${tail}`.replace(/\s+/g,' ').trim();
}
/** The crest's name, in the form the tradition names them: the ring, the count,
    then the family — 丸に八つ巴 and so on. Derived from the same numbers that
    draw it, so the label can never drift from the picture. */
/** Which ring and which of the two treatments — solid 日向 or outline 陰 — this
    pool wears. Drawing and name both read from here, so they cannot disagree. */
// The compositions the tradition actually uses. Repeating a subject round the
// circle is only one of them, and building every crest that way is what made
// them all feel like the same crest wearing different clothes.
export type Comp='radial'|'embrace'|'cross'|'stack'|'single';
const COMPS:{key:Comp;ja:string;romaji:string}[]=[
 {key:'radial',ja:'',romaji:''},
 {key:'embrace',ja:'抱き',romaji:'daki'},
 {key:'cross',ja:'違い',romaji:'chigai'},
 {key:'stack',ja:'三つ盛り',romaji:'mitsumori'},
 {key:'single',ja:'',romaji:''},
];
export function crestComp(sig:number[]){
 // Weighted toward the radial repeat, which is still the commonest form, but
 // with a real share of the others.
 const r=(sig[3]*7)%1;
 if(r<.42)return COMPS[0];
 if(r<.60)return COMPS[1];
 if(r<.74)return COMPS[2];
 if(r<.86)return COMPS[3];
 return COMPS[4];
}
// A crest often carries a second, different subject — 三割銀杏に花菱, 木瓜に唐花.
// Placing one inside, at the centre, or ringing it outside multiplies what the
// same set of subjects can say.
export type Sub={fam:number;where:'none'|'centre'|'inner'|'outer'};
const SUB_KANJI=['花菱','唐花','巴','星','桜'];
const SUB_ROMAJI=['hanabishi','karahana','tomoe','hoshi','sakura'];
export function crestSub(sig:number[]):Sub{
 // Constraints, not more knobs. Every extra choice multiplies the number of
 // combinations, and most of the broken crests came from combinations that the
 // tradition never makes: an outline crest already carries a lot of line, so it
 // takes no second subject; a stacked or crossed arrangement is a statement on
 // its own and is not decorated further. Only the radial and enclosed forms —
 // the ones with a clear centre and a clear ring of space — accept one.
 const{kage}=crestStyle(sig);
 const comp=crestComp(sig).key;
 if(kage||comp==='stack'||comp==='cross'||comp==='embrace')return{fam:0,where:'none'};
 const r=(sig[2]*29)%1;
 if(r<.62)return{fam:0,where:'none'};
 const fam=Math.floor(((sig[0]*17)%1)*SUB_KANJI.length);
 // Enclosed crests hold their second subject at the centre; radial ones ring it.
 const where=comp==='single'?'centre':(r<.84?'centre':'inner');
 return{fam,where};
}
/** How many rings the frame carries: 一重, 二重, 三重. */
export function crestRings(sig:number[]){return 1+Math.floor(((sig[1]*23)%1)*3)}
/** 対い or 追い: is the crest mirrored about its axis, or purely turned? */
export function crestMirror(sig:number[]){return((sig[5]*19)%1)<.34}
export function crestStyle(sig:number[]){
 const ring=RINGS[Math.floor(sig[4]*RINGS.length)%RINGS.length];
 // 石持地抜き lifts the subject out of a solid field, which only works if the
 // subject is a solid shape. Combined with 陰 there is nothing but hairlines to
 // lift, and the crest comes out as a plain filled disc — so the two never meet.
 const kage=!ring.negative&&((sig[2]*13)%1)<.26;
 // 石持地抜き lifts the subject out of a solid field, so the subject has to be
 // something with body. The shell is drawn as a band and leaves the field almost
 // untouched, which reads as a plain disc — it takes an ordinary ring instead.
 if(ring.negative&&Math.floor(sig[0]*8)%8===7)return{ring:RINGS[0],kage};
 return{ring,kage};
}
export function crestName(sig:number[]){
 const fam=Math.floor(sig[0]*8)%8;
 const{ring,kage}=crestStyle(sig);
 const comp=crestComp(sig);
 const k=kage?'陰':'';
 if(fam===7)return`${ring.ja}${k}亀甲`;
 const subject=FAMILY_KANJI[fam];
 // 抱き柏, 違い鷹の羽, 三つ盛り星 — the composition is named before the subject,
 // and only the radial form is counted.
 const sub=crestSub(sig);
 const tail=sub.where==='none'?'':`に${SUB_KANJI[sub.fam]}`;
 const rings=crestRings(sig),dbl=ring.bare||ring.negative?'':['','二重','三重'][rings-1];
 const frame=dbl?`${dbl}${ring.ja}`:ring.ja;
 if(comp.key!=='radial')return`${frame}${k}${comp.ja}${subject}${tail}`;
 const div=DIV_KANJI[Math.floor(sig[1]*DIVISIONS.length)%DIVISIONS.length];
 return`${frame}${k}${div}${subject}${tail}`;
}
const CREST:Mode=(()=>{

 /** An arc drawn from A to B bulging by `h`, found the way a compass finds it:
     the radius that satisfies the chord and the rise, then its centre on the
     perpendicular bisector. This is the only curve primitive the crest uses. */
 const bulge=(c:CanvasRenderingContext2D,ax:number,ay:number,bx:number,by:number,h:number)=>{
  const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);
  if(L<.01)return;
  if(Math.abs(h)<.4){c.lineTo(bx,by);return}
  const r=(L*L/4+h*h)/(2*Math.abs(h));        // radius from chord and rise
  const mx=(ax+bx)/2,my=(ay+by)/2;
  const px=-dy/L,py=dx/L;                     // perpendicular to the chord
  const sgn=h>0?1:-1,d=r-Math.abs(h);
  const cx0=mx-px*d*sgn,cy0=my-py*d*sgn;
  const a0=Math.atan2(ay-cy0,ax-cx0),a1=Math.atan2(by-cy0,bx-cx0);
  // Which way round? Guessing it from the sign of the rise is wrong whenever the
  // centre lands on the far side, and the arc then sweeps the long way and
  // encloses the whole field — which is what turned some crests into solid discs.
  // Take the direction whose arc actually passes through the intended apex.
  const apexX=mx+px*h,apexY=my+py*h;   // where the rise puts the top of the arc
  const mid=(ccw:boolean)=>{
   let delta=a1-a0;
   if(ccw){while(delta>0)delta-=TAU;while(delta<=-TAU)delta+=TAU}
   else{while(delta<0)delta+=TAU;while(delta>=TAU)delta-=TAU}
   const am=a0+delta/2;
   return[cx0+Math.cos(am)*r,cy0+Math.sin(am)*r];
  };
  const[fx,fy]=mid(false),[tx2,ty2]=mid(true);
  const dF=Math.hypot(fx-apexX,fy-apexY),dT=Math.hypot(tx2-apexX,ty2-apexY);
  c.arc(cx0,cy0,r,a0,a1,dT<dF);
 };

 return{
  count:1,streak:0,wrap:'radial',
  seed(ag){ag.a=0;ag.life=1e9;ag.w=1;ag.u=0},
  force(){return[0,0]},
  ink(d,ag,pulse){return{core:axisCss(d,0,72,.9*pulse),halo:axisCss(d,0,52,.3*pulse),width:1}},
  draw(c,_ags,d,t,R,cx,cy){
   const sh=shape(d),A=d.axes;
   const famIdx=Math.floor(d.sig[0]*8)%8;
   // A tortoise shell is six-sided by definition; the rest take the pool's division.
   const N=famIdx===7?6:DIVISIONS[Math.floor(d.sig[1]*DIVISIONS.length)%DIVISIONS.length];
   const family=Math.floor(d.sig[0]*8)%8;
   const mean=A.reduce((a,b)=>a+b,0)/6;
   const breathe=1+.010*Math.sin(t*.005*sh.tempo);
   const turn=t*.00009*sh.tempo*sh.spin;      // barely moving: an emblem, not a wheel
   const hue=((d.hueBase%1)+1)%1*360;
   // Ink on paper: the crest is laid down dark, with a pale wash inside the
   // strokes, because the washi plate behind it is light.
   const ink=(l:number,a:number)=>`hsl(${hue} 42% ${l}% / ${a})`;
   // Flat sumi is the tradition; this is a reading of it, so the mass is filled
   // with a gradient in the pool's own colour and only the cut stays hard.
   const wash=(deep:boolean)=>{
    const g=c.createLinearGradient(cx-S*.7,cy-S*.7,cx+S*.7,cy+S*.7);
    g.addColorStop(0,`hsl(${hue} 46% ${deep?30:38}%)`);
    g.addColorStop(.52,`hsl(${hue} 52% ${deep?19:24}%)`);
    g.addColorStop(1,`hsl(${(hue+18)%360} 44% ${deep?13:17}%)`);
    return g;
   };
   const S=R*breathe;
   // The other motifs draw light and are composited additively. A crest is ink:
   // leaving that on made every overlap glow and turned the petals translucent.
   c.globalCompositeOperation='source-over';
   c.lineJoin='round';c.lineCap='round';

   // The compass settings, taken from the six axes.
   const{ring,kage}=crestStyle(d.sig);
   const comp=crestComp(d.sig).key;
   const sub=crestSub(d.sig),ringCount=crestRings(d.sig),mirror=crestMirror(d.sig);
   const rim=S*.84;
   // The ring's weight is the score, scaled by the kind of ring the pool wears —
   // 太丸 heavy, 糸輪 barely there, 石持地抜き not a ring at all but a filled disc.
   const ringW0=ring.bare||ring.negative?0:(1.1+mean*3.6)*ring.w;
   // A kamon is bounded by its ring: nothing may cross it. The working radius is
   // set inside the ring first and every element is sized against that, so a
   // high-scoring pool cannot grow out of its own circle.
   // A cornered ring (八角井筒, 亀甲) has its vertices on rim, so its EDGES run
   // closer in than that. Containment has to use the inradius or the subject
   // bursts straight through the flat of the frame.
   const bound=ring.sides?rim*Math.cos(Math.PI/ring.sides):rim;
   const inner=bound-ringW0*(1.7+1.9*(crestRings(d.sig)-1))-S*.035;
   const fit=(r:number)=>Math.min(r,inner);
   // Real crests carry their subject right out to the ring; a timid one reads as
   // a diagram of a crest rather than a crest.
   // ---- proportion ----
   // Left to raw data every radius lands on its own arbitrary value, and a set of
   // crests drawn that way has no common rhythm. Architecture and figure drawing
   // both answer this the same way: pick a module and let every dimension be a
   // whole number of it. Here the working circle is divided into twelve, and each
   // radius snaps to that grid — the pool still decides the proportions, but they
   // can only fall on shared steps, which is what makes a set of them look
   // related without making any two the same.
   const MOD=12,step=inner/MOD;
   const q=(v:number,min=1)=>Math.max(min,Math.round(v/step))*step;
   const reach0=q(inner*(.54+A[0]*.24),5);    // how far an element travels out
   const waist0=q(inner*(.06+A[2]*.12),1);    // how deep the waist is cut
   const base0=q(inner*(.13+A[4]*.10),1);     // where an element starts
   const hub=q(inner*(.09+A[3]*.11),1);       // the centre
   // The opening angle is divided the same way a rule is: sixths of the share
   // each element owns, never an arbitrary fraction of it.
   // The opening has to come from how many elements the COMPOSITION actually
   // lays down, not from the division count. A 囲み crest places one subject and
   // an 抱き places two, so deriving the width from a twelve-fold division left
   // a single sliver alone in a large circle.
   const effN=comp==='single'?1:comp==='embrace'||comp==='cross'?2:comp==='stack'?3:N;
   const sector=Math.PI/effN;
   // Wide divisions need proportionally narrower elements, or a twelve-fold
   // crest fills solid however small each piece looks on its own.
   // `sector` is already the HALF share each element owns, so capping the opening
   // at half of that again left every petal a slender sliver and the crest bare.
   // A real petal all but fills its share, with just enough paper to read the
   // separation.
   const openCap=effN>=8?.74:effN>=5?.82:.88;
   const open=Math.min(Math.max(3,Math.round((.66+A[1]*.24)*6))/6*sector,sector*openCap);

   // No aspect squash anywhere in the crest: compass work has to stay circular,
   // and an ellipse would give the whole emblem away as a fake.
   const at=(ang:number,r:number):[number,number]=>
    [cx+Math.cos(ang)*r,cy+Math.sin(ang)*r];

   // ---- line work ----
   // Only where it has somewhere to sit. Rings drawn across the subject read as
   // construction guides left on a finished crest, so the thin work is confined
   // to the open annulus outside the elements, and dropped when there is none.
   const gap=inner-reach0;
   if(gap>S*.055){
    const lineFam=Math.floor(d.sig[4]*2)%2;
    c.strokeStyle=ink(17,.72);
    if(lineFam===0){                           // 目結: short spokes in the gaps
     c.lineWidth=1;
     for(let i=0;i<N;i++){
      const ang=turn+sh.rot+(i+.5)*TAU/N-Math.PI/2;
      const[x0,y0]=at(ang,reach0+gap*.22),[x1,y1]=at(ang,inner-gap*.12);
      c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();
     }
    }else{                                     // 光琳: one hairline just inside the ring
     c.lineWidth=1.1;
     c.beginPath();c.arc(cx,cy,inner-gap*.3,0,TAU);c.stroke();
    }
   }

   // ---- the repeated element ----
   // Clipped to the working circle as a guarantee: whatever the numbers ask for,
   // the crest cannot spill past its ring.
   // 石持地抜き: the field is inked solid and the subject is lifted back out of
   // it, so the crest reads white on black instead of black on paper.
   if(ring.negative){
    c.beginPath();c.arc(cx,cy,rim,0,TAU);
    c.fillStyle=wash(true);c.fill();
   }
   c.save();
   c.beginPath();c.arc(cx,cy,inner,0,TAU);c.clip();
   if(ring.negative)c.globalCompositeOperation='destination-out';
   // Each repeat has to fit its own share of the circle. Clipping it to a wedge
   // does keep it there, but it also cuts strokes off in mid-air and leaves
   // floating fragments, so the elements are sized to fit instead.
   // ---- composition ----
   // A crest is not only a subject; it is a subject ARRANGED. Repeating one
   // element round the circle is just one of the tradition's compositions, and
   // building every crest that way is what made them all feel related. The
   // reference sheets are full of the others: 抱き柏 holds two leaves facing each
   // other, 違い鷹の羽 crosses two feathers, 三つ盛り stacks three, and 丸に橘 sets a
   // single subject inside its ring. The pool picks the composition, then the
   // subject, then the ring.
   //
   // To arrange an element anywhere it has to be drawn as a shape in its own
   // right rather than in polar coordinates around the centre, so the subject is
   // built pointing up and the composition places it with a transform.
   const atL=(a:number,r:number):[number,number]=>[Math.sin(a)*r,-Math.cos(a)*r];
   const subject=(r0:number,r1:number,spread:number,waist:number,fam=family)=>{
    const family=fam;
    // The half-width of a lens grows with its length, so a long element ends up
    // wider than the share it owns and the repeats close into a solid disc.
    // Cap it against the arc available at the tip.
    // Width taken from the arc the element owns, not from the tangent of half
    // its opening: the latter gives a sliver that leaves the crest looking bare.
    const span=(f:number)=>r1*Math.sin(spread)*f;
    c.beginPath();
    if(family===0){                                   // lens petal
     const[bx,by]=atL(0,r0),[tx,ty]=atL(0,r1+waist*1.5);
     const w=span(.86);
     bulge(c,bx,by,tx,ty,w);
     bulge(c,tx,ty,bx,by,w);
    }else if(family===1){                             // mokkō lobe
     const[p0x,p0y]=atL(-spread,r0+waist),[p1x,p1y]=atL(spread,r0+waist);
     const[m0x,m0y]=atL(-spread,r1),[m1x,m1y]=atL(spread,r1);
     c.moveTo(p0x,p0y);
     bulge(c,p0x,p0y,m0x,m0y,waist*.5);
     bulge(c,m0x,m0y,m1x,m1y,-(r1-r0)*.42);
     bulge(c,m1x,m1y,p1x,p1y,waist*.5);
     bulge(c,p1x,p1y,p0x,p0y,-waist*.7);
    }else if(family===2){                             // tomoe comma
     const hr=r1*.86,head=Math.min((r1-r0)*.42,hr*Math.sin(spread*.95));
     const[hx,hy]=atL(0,hr);
     const aOut=-Math.PI/2,aIn=Math.PI/2;
     const ax2=hx+Math.cos(aOut)*head,ay2=hy+Math.sin(aOut)*head;
     const bx3=hx+Math.cos(aIn)*head,by3=hy+Math.sin(aIn)*head;
     const[tipx,tipy]=atL(spread*.9,r0);
     c.moveTo(tipx,tipy);
     bulge(c,tipx,tipy,ax2,ay2,head*.55);
     c.arc(hx,hy,head,aOut,aIn,false);
     bulge(c,bx3,by3,tipx,tipy,-head*.30);
    }else if(family===3){                             // ume: a plain circle
     const rr=(r1-r0)*.5,[px,py]=atL(0,(r0+r1)*.5);
     c.arc(px,py,rr,0,TAU);
    }else if(family===4){                             // sakura, notched at the tip
     const tip=r1+waist*1.2,sp=spread*.5;
     const[bx,by]=atL(0,r0);
     const[lx,ly]=atL(-sp,tip),[rx,ry]=atL(sp,tip);
     const[nx2,ny2]=atL(0,tip*.82);
     const w=span(.78);
     c.moveTo(bx,by);
     bulge(c,bx,by,lx,ly,w);
     bulge(c,lx,ly,nx2,ny2,-waist*.35);
     bulge(c,nx2,ny2,rx,ry,-waist*.35);
     bulge(c,rx,ry,bx,by,w);
    }else if(family===5){                             // ginkgo fan
     const[l0x,l0y]=atL(-spread,r0+waist*.6),[r0x,r0y]=atL(spread,r0+waist*.6);
     const[l1x,l1y]=atL(-spread*.92,r1),[r1x,r1y]=atL(spread*.92,r1);
     const[cutx,cuty]=atL(0,r1*.80);
     c.moveTo(l0x,l0y);
     bulge(c,l0x,l0y,l1x,l1y,waist*.3);
     bulge(c,l1x,l1y,cutx,cuty,-waist*.25);
     bulge(c,cutx,cuty,r1x,r1y,-waist*.25);
     bulge(c,r1x,r1y,r0x,r0y,waist*.3);
     bulge(c,r0x,r0y,l0x,l0y,-waist*.55);
    }else if(family===6){                             // hawk feather
     const tip=r1+waist*1.8,narrow=spread*.34;
     const[bx,by]=atL(0,r0*.8),[tx,ty]=atL(0,tip);
     const w=span(.34);
     bulge(c,bx,by,tx,ty,w);
     bulge(c,tx,ty,bx,by,w*.42);
    }else{                                            // kikkō, the one drawn straight
     const half=Math.PI/6*.92;
     const[ax,ay]=atL(-half,r1),[bx2,by2]=atL(half,r1);
     const[ix,iy]=atL(half,r1*.62),[jx,jy]=atL(-half,r1*.62);
     c.moveTo(ax,ay);c.lineTo(bx2,by2);c.lineTo(ix,iy);c.lineTo(jx,jy);
    }
    c.closePath();
    if(kage){c.strokeStyle=ink(20,.95);c.lineWidth=2.2;c.stroke()}
    else{c.fillStyle=wash(false);c.fill()}
   };

   // Place one subject: turned about the centre, and optionally shifted off it.
   const place=(rot:number,k:number,dx=0,dy=0,fam=family)=>{
    c.save();
    c.translate(cx+dx,cy+dy);
    c.rotate(rot);
    subject(base0*k,reach0*k,open,waist0*k,fam);
    c.restore();
   };

   // Doubling only reads on a coarse division; on a fine one it fills the middle.
   const layered=comp==='radial'&&N<=6&&((d.sig[3]*11)%1)<.5;
   const compose=()=>{
   if(comp==='single'){
    // 囲み: the ring holds one subject and nothing else. Rooted below centre so
    // it sits in the circle rather than radiating out of the middle of it.
    place(0,1.30,0,inner*.38);
   }else if(comp==='embrace'){
    // 抱き: the pair share a root low in the circle and sweep up and outward,
    // the way 抱き柏 does. Radiating both from the centre left the whole crest
    // sitting in the top half with the bottom empty.
    const root=inner*.52;
    place(-.46,1.22,0,root);place(.46,1.22,0,root);
   }else if(comp==='cross'){
    // 違い: each element is rooted on the far side so it crosses the centre,
    // rather than pointing away from it.
    const root=inner*.66;
    for(const a of[-.72,.72]){
     place(a,1.30,-Math.sin(a)*root,Math.cos(a)*root);
    }
   }else if(comp==='stack'){
    // 三つ盛り: stacked, not turned — each stays upright.
    // Balanced on the centre: an equilateral set, each element the same size, so
    // the crest sits square in its ring instead of hanging off the top.
    const u=inner*.34,k=.60;
    place(0,k,0,-u);
    place(0,k,-u*.866,u*.5);
    place(0,k,u*.866,u*.5);
   }else{
    for(let i=0;i<N;i++)place(i*TAU/N+turn+sh.rot,1);
    if(layered)for(let i=0;i<N;i++)place(i*TAU/N+Math.PI/N+turn+sh.rot,.56);
   }
   };
   compose();
   // 対い against 追い: a mirrored crest faces itself across the axis, a turned
   // one chases itself round. Both are named forms and they read quite
   // differently, so the pool gets one or the other.
   if(mirror){
    c.save();
    c.translate(cx,cy);c.scale(-1,1);c.translate(-cx,-cy);
    compose();
    c.restore();
   }
   // The second subject, set where the tradition sets it.
   if(sub.where!=='none'){
    const SUBFAM=[0,4,2,3,4][sub.fam]??0;
    // Sized from the room actually left inside the primary, so the two subjects
    // never sit on top of one another.
    const room=base0/reach0;
    if(sub.where==='centre'){
     place(0,Math.min(.40,room*1.5),0,0,SUBFAM);
    }else{
     const m=Math.max(3,Math.min(6,N));
     for(let i=0;i<m;i++)place(i*TAU/m+Math.PI/m+turn+sh.rot,Math.min(.34,room*1.2),0,0,SUBFAM);
    }
   }

   c.restore();
   c.globalCompositeOperation='source-over';

   // ---- the hub ----
   // Not every crest has one. A radial arrangement usually wants a centre to
   // turn about, but an enclosed, stacked or crossed subject already resolves
   // itself and a disc dropped in the middle only crowds it — so the hub is
   // omitted there, and on a share of the radial ones too.
   const hasHub=comp==='radial'&&sub.where!=='centre'&&((d.sig[0]*37)%1)<.72;
   if(hasHub){
   c.beginPath();c.arc(cx,cy,hub,0,TAU);
   if(ring.negative){c.globalCompositeOperation='destination-out';c.fill();c.globalCompositeOperation='source-over';}
   else{c.fillStyle=wash(true);c.fill()}
    if(A[5]>.5){                              // a second compass ring when latency is good
     c.beginPath();c.arc(cx,cy,hub*1.55,0,TAU);
     c.strokeStyle=ink(24,.6);c.lineWidth=1;c.stroke();
    }
   }

   // ---- the ring: "maru ni", weighted by the score, cut where a flag is raised ----
   const ringW=ringW0;
   // 八角井筒 and 亀甲 are cornered rings; the rest are drawn with the compass.
   const seg=(from:number,to:number)=>{
    c.beginPath();
    if(ring.sides){
     const n=ring.sides,step=TAU/n;
     for(let k=0;k<=n;k++){
      const a=sh.rot+k*step-Math.PI/2;
      const x=cx+Math.cos(a)*rim,y=cy+Math.sin(a)*rim;
      k?c.lineTo(x,y):c.moveTo(x,y);
     }
    }else c.arc(cx,cy,rim,from,to);
    c.strokeStyle=ink(16,.95);c.lineWidth=ringW;c.stroke();
   };
   if(!ring.bare&&!ring.negative){
    // 一重, 二重, 三重: the frame is not always a single line.
    for(let k=1;k<ringCount;k++){
     c.beginPath();c.arc(cx,cy,rim-ringW*(1.6+1.9*(k-1))-k*2,0,TAU);
     c.strokeStyle=ink(18,.8);c.lineWidth=Math.max(.9,ringW*.42);c.stroke();
    }
    const cuts=d.warnAxes.map(a=>((sh.rot+a*TAU/6-Math.PI/2)%TAU+TAU)%TAU).sort((a,b)=>a-b);
    if(!cuts.length||ring.sides)seg(0,TAU);
    else for(let i=0;i<cuts.length;i++){
     const from=cuts[i]+.2,to=(i===cuts.length-1?cuts[0]+TAU:cuts[i+1])-.2;
     if(to>from)seg(from,to);
    }
    c.beginPath();c.arc(cx,cy,rim+ringW*2,0,TAU);
    c.strokeStyle=ink(30,.34);c.lineWidth=.9;c.stroke();
   }
  }
 };
})();

const MODES=[LINE,STRUCTURE,ORBIT,VOICE,CREST];

export default function PoolArt({data,motif}:{data:ArtData;motif:number}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const cv=ref.current;if(!cv)return;
  const ctx=cv.getContext('2d');if(!ctx)return;
  const mode=MODES[motif-1]||MODES[0];
  let raf=0,t=0,W=0,H=0,ags:Agent[]=[];

  const build=(w:number,h:number)=>{
   W=w;H=h;
   const R=Math.min(W,H)*.46,cx=W/2,cy=H/2;
   ags=new Array(mode.count).fill(0).map((_,i)=>{
    const ag:Agent={x:0,y:0,vx:0,vy:0,a:0,seed:i*1.618+.31,age:0,life:1,w:1,u:0,light:1};
    mode.seed(ag,data,W,H);
    ag.age=rnd(i)*Math.min(ag.life,400);  // stagger, so the field does not pulse
    ag.x=cx+ag.x*R;ag.y=cy+ag.y*R;
    return ag;
   });
  };

  const draw=()=>{
   const dpr=Math.min(devicePixelRatio||1,2),b=cv.getBoundingClientRect();
   const w=Math.max(2,Math.floor(b.width*dpr)),h=Math.max(2,Math.floor(b.height*dpr));
   const resized=cv.width!==w||cv.height!==h;
   if(resized){cv.width=w;cv.height=h}
   ctx.setTransform(dpr,0,0,dpr,0,0);
   // Build on the first frame of this mode as well as on resize: switching modes
   // leaves the canvas the same size, so a resize-only check would never seed
   // the new mode's agents.
   if(resized||!ags.length)build(b.width,b.height);

   // Wipe to transparent, like the particle view. Nothing survives a frame.
   ctx.clearRect(0,0,W,H);
   ctx.globalCompositeOperation='lighter';

   const sh=shape(data);
   const R=Math.min(W,H)*.46,cx=W/2,cy=H/2,step=(.62+data.speedMul*.85)*sh.tempo;
   const advance=(x:number,y:number,vx:number,vy:number,ag:Agent)=>{
    const[fx,fy]=mode.force(ag,data,t,(x-cx)/R,(y-cy)/R);
    const nvx=(vx+fx*.06)*.9,nvy=(vy+fy*.06)*.9;   // damped, so motion stays fluid
    return[x+nvx*step*R*.045,y+nvy*step*R*.045,nvx,nvy];
   };

   for(const ag of ags){
    const[nx,ny,nvx,nvy]=advance(ag.x,ag.y,ag.vx,ag.vy,ag);
    ag.x=nx;ag.y=ny;ag.vx=nvx;ag.vy=nvy;
    ag.age++;
    const rx=(ag.x-cx)/R,ry=(ag.y-cy)/R;
    const out=mode.wrap==='radial'
     ?Math.hypot(rx,ry)>1.3
     :rx>1.08||rx<-1.2||ag.y<-H*.15||ag.y>H*1.15;
    if(ag.age>ag.life||out){
     ag.seed+=7.77;
     mode.seed(ag,data,W,H);
     ag.age=0;ag.vx=0;ag.vy=0;
     ag.x=cx+ag.x*R;ag.y=cy+ag.y*R;
    }
   }

   if(mode.draw)mode.draw(ctx,ags,data,t,R,cx,cy);
   else for(const ag of ags){
    // Trace the streamline this agent is on, forward from where it is now.
    let x=ag.x,y=ag.y,vx=ag.vx,vy=ag.vy;
    // Light travels through the field as a wave rather than sitting still, so
    // brightness sweeps outward instead of every stroke burning evenly.
    const rad=Math.hypot((ag.x-cx)/R,(ag.y-cy)/R);
    const pulse=.22+.78*(.5+.5*Math.sin(rad*7.4-t*.042*data.speedMul*sh.tempo+ag.seed*.9));
    const{core,halo,width}=mode.ink(data,ag,pulse);
    // Vary the length per agent so long sweeps mix with short flecks.
    const steps=Math.max(4,Math.round(mode.streak*(.4+ag.w)));
    ctx.beginPath();ctx.moveTo(x,y);
    for(let k=0;k<steps;k++){
     [x,y,vx,vy]=advance(x,y,vx,vy,ag);
     ctx.lineTo(x,y);
    }
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle=halo;ctx.lineWidth=width*5.5;ctx.stroke();   // bloom
    ctx.strokeStyle=core;ctx.lineWidth=width;ctx.stroke();       // filament
   }

   ctx.globalCompositeOperation='source-over';
   t++;raf=requestAnimationFrame(draw);
  };
  draw();
  return()=>cancelAnimationFrame(raf);
 },[data,motif]);
 return <canvas ref={ref} className="block-art pool-art" aria-label={`${data.ticker} relay-health artwork`}/>;
}
