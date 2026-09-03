'use client';
import {useCallback,useState} from 'react';
import {type Chain,type World,WORLDS} from './chain-kit';
import WorldGlass from './world-glass';
import WorldPop from './world-pop';
import WorldSumi from './world-sumi';
import WorldDot from './world-dot';

/* The chain, four ways.
   ------------------------------------------------------------------
   One feed, one set of meanings, four explorers that share no layout at all.
   Soap in the dark, cut paper on cream, ink down a scroll, pixels on a screen.

   They are not skins over a common frame. A skin keeps the frame's argument
   and only repaints it, and the frame's argument is exactly the thing each of
   these is meant to make differently. Glass says the chain is a specimen. Pop
   says it is a pile of things a lot of different people made. Ink says it is a
   record. Dot says it is a readout. All four are true of Cardano and none of
   them is true enough alone - which is the reason to build four rather than to
   pick one and defend it.

   What none of them may do is disagree about the reading: a pool is the same
   colour in all four, a block is the same size, an empty block is empty. That
   lives in `chain-kit`, and it is the difference between a set and a novelty.

   Picked the way an app is picked, because that is the honest interface for
   "here are four, have a look". The choice is remembered - somebody who
   prefers ink should not have to ask for it twice. */

const ICONS:Record<World,React.ReactNode>={
 glass:<svg viewBox="0 0 40 40" aria-hidden="true">
  <defs><radialGradient id="wi-g" cx="50%" cy="50%" r="50%">
   <stop offset="60%" stopColor="#0a1024" stopOpacity="0"/>
   <stop offset="88%" stopColor="#7fd0ff" stopOpacity=".5"/>
   <stop offset="100%" stopColor="#ff8ad8" stopOpacity=".9"/>
  </radialGradient></defs>
  <circle cx="20" cy="20" r="14" fill="url(#wi-g)"/>
  <circle cx="20" cy="20" r="14" fill="none" stroke="#9fd8ff" strokeWidth=".9" opacity=".7"/>
  <circle cx="16" cy="17" r="1.9" fill="#8ff0d0"/><circle cx="24" cy="22" r="1.5" fill="#8ff0d0"/>
 </svg>,
 pop:<svg viewBox="0 0 40 40" aria-hidden="true">
  <polygon points="12,7 21,7 21,16 12,16" fill="#ffd23f" stroke="#170d24" strokeWidth="2"/>
  <polygon points="27,9 34,21 20,21" fill="#ff4fa3" stroke="#170d24" strokeWidth="2"/>
  <circle cx="14" cy="27" r="6" fill="#3fd8ff" stroke="#170d24" strokeWidth="2"/>
  <polygon points="28,23 34,27 32,34 25,34 23,27" fill="#8affc1" stroke="#170d24" strokeWidth="2"/>
 </svg>,
 sumi:<svg viewBox="0 0 40 40" aria-hidden="true">
  {/* Ink needs paper under it, or the icon is a black square on a black shelf. */}
  <rect width="40" height="40" fill="#efe4cd"/>
  <path d="M31 14a13 13 0 1 0 2 9" fill="none" stroke="#14100f" strokeWidth="3.4" strokeLinecap="round"/>
  <circle cx="17" cy="19" r="1.6" fill="#14100f"/><circle cx="23" cy="23" r="1.3" fill="#14100f"/>
  <rect x="27" y="27" width="7" height="7" rx="1" fill="#9e2019"/>
 </svg>,
 dot:<svg viewBox="0 0 40 40" shapeRendering="crispEdges" aria-hidden="true">
  {[0,1,2,3,4,5,6].map(i=><g key={i}>
   <rect x={8+i*4} y="8" width="4" height="4" fill="#39d98a"/>
   <rect x={8+i*4} y="32" width="4" height="4" fill="#39d98a"/>
   <rect x="8" y={8+i*4} width="4" height="4" fill="#39d98a"/>
   <rect x="32" y={8+i*4} width="4" height="4" fill="#39d98a"/>
  </g>)}
  <rect x="16" y="16" width="4" height="4" fill="#eafff2"/>
  <rect x="24" y="16" width="4" height="4" fill="#eafff2"/>
  <rect x="20" y="24" width="4" height="4" fill="#eafff2"/>
 </svg>,
};

const LABEL:Record<World,{name:string;ja:string;en:string}>={
 glass:{name:'GLASS',ja:'泡',en:'SOAP'},
 pop:{name:'POP',ja:'紙',en:'PAPER'},
 sumi:{name:'墨',ja:'筆',en:'INK'},
 dot:{name:'DOT',ja:'点',en:'PIXEL'},
};

/* Three of the four are finished and kept, but not shown. The top screen is
   the disc again, and a shelf of four styles directly under it turns the page
   into a menu of itself - the reader is asked to pick a look before they have
   been given a reason to care. Flip this to show the shelf again; nothing else
   has to change. */
const SHOW_DOCK=false;
const ONLY:World='glass';

const KEY='onchain-world';
const VIEWS={glass:WorldGlass,pop:WorldPop,sumi:WorldSumi,dot:WorldDot};

export default function ChainExplorer(props:{
 chain:Chain|null;tickers:Map<string,string>;onPick?:(pool:string)=>void;lang:'ja'|'en';
}){
 /* Read once, on the way in, rather than set from an effect afterwards - the
    second way renders the wrong world first and then corrects it. The site is
    client-rendered, so there is no server pass to disagree with. */
 const [world,setWorld]=useState<World>(()=>{
  if(!SHOW_DOCK)return ONLY;
  if(typeof window==='undefined')return 'glass';
  try{
   const v=localStorage.getItem(KEY);
   if(v&&(WORLDS as readonly string[]).includes(v))return v as World;
  }catch{/* a browser that will not remember is not a reason to fail */}
  return 'glass';
 });
 const choose=useCallback((w:World)=>{
  setWorld(w);
  try{localStorage.setItem(KEY,w)}catch{/* as above */}
 },[]);

 const View=VIEWS[world];
 const heading=props.lang==='ja'?'見かたを選ぶ':'CHOOSE HOW TO LOOK';

 return <section id="chain" className="chain-shell" data-world={world}>
  {SHOW_DOCK&&<nav className="world-dock" aria-label={heading}>
   <span className="wdk-label">{heading}</span>
   <ul>
    {WORLDS.map(w=>{
     const l=LABEL[w];
     return <li key={w}>
      <button type="button" className={w===world?'on':''} aria-pressed={w===world}
        onClick={()=>choose(w)}>
       <i className="wdk-icon">{ICONS[w]}</i>
       <b>{l.name}</b>
       <em>{props.lang==='ja'?l.ja:l.en}</em>
      </button>
     </li>;
    })}
   </ul>
  </nav>}
  <View {...props}/>
 </section>;
}
