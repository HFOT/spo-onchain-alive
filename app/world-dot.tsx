'use client';
import {useEffect,useRef,useState} from 'react';
import {type WorldProps,type ChainBlock,hsl,css,mix32,seedOf,hueOf,sizeOf,nameOf,readChain} from './chain-kit';

/* DOT.
   ------------------------------------------------------------------
   A screen. Blocks are laid out as cells on a grid the way a console lists
   things, and each cell is drawn as pixels big enough to count.

   That last part is the whole idea. In the other worlds a block's transactions
   are shown - a crowd inside a bubble, dots inside a ring - and you take the
   number on trust. Here they are lit pixels in a cell, so the count is not
   depicted, it is displayed: nine transactions is nine squares, and an empty
   block is an empty box that anybody can check at a glance. A low resolution
   turns out to be the honest one.

   Nothing is antialiased. Smoothing a pixel is the single thing that stops it
   reading as a pixel, so every edge here lands on the grid or not at all, and
   the palette is cut to sixteen hues for the same reason. */

const HUES=16;                 // the palette, so the page reads as one machine
const CELL=7;                  // pixels across a block's cell: a 5x5 interior
const COLS=8,ROWS=5;

type Cell={b:ChainBlock;x:number;y:number;w:number};

export default function WorldDot({chain,tickers,onPick,lang}:WorldProps){
 const canvas=useRef<HTMLCanvasElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const cells=useRef<Cell[]>([]);
 const [hover,setHover]=useState<ChainBlock|null>(null);
 const t=lang==='ja'?JA:EN;
 const {ep,tip,blocks,pct,leftDays,fill,seen}=readChain(chain);
 const shown=hover||blocks[0]||null;

 useEffect(()=>{
  const c=canvas.current,st=stage.current;
  if(!c||!st)return;
  const ctx=c.getContext('2d');
  if(!ctx)return;
  ctx.imageSmoothingEnabled=false;
  let raf=0,t0=0;

  const draw=(now:number)=>{
   if(!t0)t0=now;
   const time=(now-t0)/1000;
   const dpr=Math.min(devicePixelRatio||1,2),b=st.getBoundingClientRect();
   const W=Math.max(2,Math.round(b.width*dpr)),H=Math.max(2,Math.round(b.height*dpr));
   if(c.width!==W||c.height!==H){c.width=W;c.height=H}
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,W,H);
   ctx.imageSmoothingEnabled=false;

   const list=blocks.slice(0,COLS*ROWS);
   // One pixel, in pixels. Everything else is a whole number of these, which
   // is what keeps the grid from drifting off itself.
   /* The HUD rails and the legend own the top and bottom of the screen. The
      grid is laid out in what is left, rather than under them. */
   const padT=Math.round(H*.2),padB=Math.round(H*.14);
   const band=Math.max(40,H-padT-padB);
   const px=Math.max(2,Math.floor(Math.min(W/(COLS*(CELL+4)),band/(ROWS*(CELL+5)))));
   const cw=px*(CELL+4),ch=px*(CELL+5);
   const ox=Math.round((W-cw*COLS)/2),oy=padT+Math.round((band-ch*ROWS)/2);
   const out:Cell[]=[];

   list.forEach((blk,i)=>{
    const col=i%COLS,row=Math.floor(i/COLS);
    const x=ox+col*cw,y=oy+row*ch;
    out.push({b:blk,x,y,w:px*CELL});
    const sd=seedOf(blk);
    // Sixteen hues. A pool keeps its colour, but rounded to what the machine
    // can say.
    const hue=Math.floor(hueOf(blk,tickers)*HUES)/HUES;
    const on=hover&&hover.h===blk.h;
    const dim=i===0?1:.62-Math.min(.34,i*.016);
    const wall=hsl(hue,.72,on?.72:.5*dim+.14);
    const lit=hsl(hue,.9,on?.86:.62*dim+.2);

    // The box. Drawn a pixel at a time so the corners are square, not rounded.
    ctx.fillStyle=css(wall);
    for(let k=0;k<CELL;k++){
     ctx.fillRect(x+k*px,y,px,px);
     ctx.fillRect(x+k*px,y+(CELL-1)*px,px,px);
     ctx.fillRect(x,y+k*px,px,px);
     ctx.fillRect(x+(CELL-1)*px,y+k*px,px,px);
    }
    /* The contents. One lit pixel per transaction, stacked from the floor of
       the cell upward, so a block fills like a vessel and the number can be
       counted off the screen rather than taken on trust. A block holding more
       than the cell does gets its top pixel blinking - the machine saying "and
       more" instead of quietly lying about the count. */
    const w=CELL-2,room=w*w;
    const n=Math.min(blk.tx,room);
    ctx.fillStyle=css(lit);
    for(let k=0;k<n;k++){
     const cxp=1+k%w,cyp=CELL-2-Math.floor(k/w);
     const blink=blk.tx>room&&k===n-1&&Math.sin(time*6)<0;
     if(blink)continue;
     ctx.fillRect(x+cxp*px,y+cyp*px,px,px);
    }
    // Size, as a bar under the cell: one more thing the grid can say plainly.
    const bar=Math.max(1,Math.round(sizeOf(blk.sz)*CELL));
    ctx.fillStyle=css(wall,.85);
    for(let k=0;k<bar;k++)ctx.fillRect(x+k*px,y+(CELL+1)*px,px,px);
    // A cursor on whichever cell is being read.
    if(on){
     ctx.fillStyle=css(lit);
     const m=px;
     ctx.fillRect(x-m*2,y-m*2,m*3,m);ctx.fillRect(x-m*2,y-m*2,m,m*3);
     ctx.fillRect(x+px*CELL-m,y-m*2,m*3,m);ctx.fillRect(x+px*CELL+m,y-m*2,m,m*3);
     ctx.fillRect(x-m*2,y+px*CELL+m,m*3,m);ctx.fillRect(x-m*2,y+px*CELL-m,m,m*3);
     ctx.fillRect(x+px*CELL-m,y+px*CELL+m,m*3,m);ctx.fillRect(x+px*CELL+m,y+px*CELL-m,m,m*3);
    }
   });
   cells.current=out;
   raf=requestAnimationFrame(draw);
  };

  const at=(e:PointerEvent)=>{
   const dpr=Math.min(devicePixelRatio||1,2),b=c.getBoundingClientRect();
   const x=(e.clientX-b.left)*dpr,y=(e.clientY-b.top)*dpr;
   for(const s of cells.current)
    if(x>=s.x-4&&x<=s.x+s.w+4&&y>=s.y-4&&y<=s.y+s.w+4)return s;
   return null;
  };
  const move=(e:PointerEvent)=>{const s=at(e);c.style.cursor=s?'pointer':'default';setHover(s?s.b:null)};
  const click=(e:PointerEvent)=>{const s=at(e);if(s)onPick?.(s.b.p)};
  c.addEventListener('pointermove',move,{passive:true});
  c.addEventListener('click',click);
  raf=requestAnimationFrame(draw);
  return()=>{
   cancelAnimationFrame(raf);
   c.removeEventListener('pointermove',move);
   c.removeEventListener('click',click);
  };
 },[blocks,tickers,onPick,hover]);

 return <div className="w-dot" ref={stage}>
  <canvas ref={canvas} className="wd-canvas"/>
  <div className="wd-scan" aria-hidden="true"/>

  <div className="wd-hud wd-top">
   <span>{t.title}</span>
   <span>EP {ep?.no??'--'} {(pct*100).toFixed(1)}%</span>
  </div>

  <div className="wd-hud wd-bottom">
   <span>H {tip?tip.height.toLocaleString():'--'}</span>
   <span>BLK {ep?ep.blocks.toLocaleString():'--'}</span>
   <span>TX {ep?ep.txs.toLocaleString():'--'}</span>
   <span>FILL {(fill*100).toFixed(1)}%</span>
   <span>D-{leftDays.toFixed(2)}</span>
  </div>

  <p className="wd-legend">{t.legend}</p>

  {shown&&<button className="wd-pick" type="button" onClick={()=>onPick?.(shown.p)}>
   <b>{nameOf(shown,tickers,t.noname,t.unranked)}</b>
   <span>{shown.h.toLocaleString()}</span>
   <span>{shown.tx} TX / {shown.sz.toLocaleString()} B</span>
   <em>&gt; {t.open}</em>
  </button>}

  <p className="wd-seen">{t.seen} {seen?seen.toLocaleString():'--'}</p>
 </div>;
}

const JA={
 title:'CARDANO BLOCK GRID',
 legend:'枠のなかの光った点が、そのブロックの取引の数。数えられます。下の帯はサイズ。',
 open:'OPEN POOL',noname:'NO TICKER',unranked:'UNRANKED',seen:'OBS',
} as const;
const EN={
 title:'CARDANO BLOCK GRID',
 legend:'Each lit pixel in a box is one transaction in that block. They are countable. The bar underneath is size.',
 open:'OPEN POOL',noname:'NO TICKER',unranked:'UNRANKED',seen:'OBS',
} as const;
