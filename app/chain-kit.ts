/* What every world shares.
   ------------------------------------------------------------------
   Four explorers read this chain, and they look nothing alike: soap floating
   in the dark, cut paper tumbling on cream, ink down a hanging scroll, a
   bitmap on a console. What they are not allowed to disagree about is the
   reading. A pool is the same colour in all four. A block's size means the
   same thing. An empty block is empty everywhere.

   So the meaning lives here and the drawing lives in each world. If a world
   wants a different shape that is its business; if it wants a different
   answer, it is wrong. */

import {poolHue} from './pool-hue';

export type ChainBlock={h:number;s:number;es:number;e:number;t:number;tx:number;sz:number;p:string};
export type Chain={
 at:string;source:string;error?:string;
 tip?:{epoch:number;epoch_slot:number;abs_slot:number;height:number;time:number};
 epoch?:{no:number;slots:number;blocks:number;txs:number;fees:string;active_stake:string;start_time:number;end_time:number};
 blocks:ChainBlock[];
};

/** The worlds, in the order the launcher shows them. */
export const WORLDS=['glass','pop','sumi','dot'] as const;
export type World=(typeof WORLDS)[number];

export type WorldProps={
 chain:Chain|null;
 tickers:Map<string,string>;
 onPick?:(pool:string)=>void;
 lang:'ja'|'en';
};

export function hsl(h:number,s:number,l:number){
 const a=s*Math.min(l,1-l);
 const f=(n:number)=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(Math.min(k-3,9-k),1))};
 return[f(0),f(8),f(4)] as [number,number,number];
}
export const css=(c:[number,number,number],a=1)=>
 `rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${a})`;

/** Stable per-block randomness. The same block must look the same on every
    visit, in every world, so nothing here may come from Math.random. */
export function mix32(seed:number,n:number){
 let x=Math.imul(seed^(n+0x9e3779b9),2654435761);
 x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;
 return(x>>>0)/4294967295;
}
export const seedOf=(b:ChainBlock)=>(b.h>>>0)^0x5bf03635;

/** A block's colour is its producer's colour, everywhere. */
export const hueOf=(b:ChainBlock,t:Map<string,string>)=>poolHue(t.get(b.p)||'',b.p);

/** How big a block draws. Log, because the range runs from a four-byte header
    to tens of kilobytes and a linear scale would draw most of the chain as
    dust. Returns 0..1; each world decides what that is worth in pixels. */
export const sizeOf=(sz:number)=>Math.min(1,Math.log10(1+Math.max(0,sz))/4.4);

/** Mean bytes a transaction. Real, and the reason one fat transaction and a
    dozen thin ones do not draw the same. */
export const meanTx=(b:ChainBlock)=>b.sz/Math.max(1,b.tx);

/** A pool with a blank ticker is still a ranked pool; only a producer the
    ranking has never seen is unranked. `N/A` is the placeholder the ranking
    writes into an empty field, so it names nothing either. */
export function nameOf(b:ChainBlock,t:Map<string,string>,noname:string,unranked:string){
 if(!t.has(b.p))return unranked;
 const tk=t.get(b.p);
 return tk&&tk!=='N/A'?tk:noname;
}

/** Everything the headline figures need, from the feed, in one place. */
export function readChain(chain:Chain|null){
 const ep=chain?.epoch,tip=chain?.tip;
 return{
  ep,tip,
  blocks:chain?.blocks||[],
  pct:ep&&tip?tip.epoch_slot/ep.slots:0,
  leftDays:ep&&tip?(ep.slots-tip.epoch_slot)/86400:0,
  fill:ep&&tip&&tip.epoch_slot?ep.blocks/tip.epoch_slot:0,
  seen:chain?new Date(chain.at):null,
 };
}

/** A number as it is written in Japanese.
    Only the ink world uses this, but it belongs with the other readings rather
    than inside a drawing: it is a way of saying the figure, not of drawing it,
    and the figure is the same one every other world shows. */
const DIGIT='〇一二三四五六七八九';
const PLACE=['','十','百','千'];
const MYRIAD=['','万','億','兆'];
export function kanjiNum(n:number):string{
 if(!isFinite(n)||n<0)return '';
 n=Math.floor(n);
 if(n===0)return DIGIT[0];
 let out='',group=0;
 while(n>0&&group<MYRIAD.length){
  const chunk=n%10000;n=Math.floor(n/10000);
  if(chunk){
   let part='',c=chunk,place=0;
   while(c>0){
    const d=c%10;
    // Ten, a hundred and a thousand are not written with their leading one.
    if(d)part=(d===1&&place>0?'':DIGIT[d])+PLACE[place]+part;
    c=Math.floor(c/10);place++;
   }
   out=part+MYRIAD[group]+out;
  }
  group++;
 }
 return out;
}
