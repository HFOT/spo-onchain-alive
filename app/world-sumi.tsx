'use client';
import {useEffect,useRef,useState} from 'react';
import {type WorldProps,type ChainBlock,mix32,seedOf,sizeOf,nameOf,kanjiNum,hueOf,readChain} from './chain-kit';
import {haikuFor,type Haiku} from './haiku';

/* 墨 - ink.
   ------------------------------------------------------------------
   A hanging scroll. The blocks come down the paper the way writing does, newest
   at the top, and each one is an enso: the circle drawn in a single breath,
   thick where the brush was loaded and thin where it ran out, never quite
   closed, because a closed one is a printed O and this is supposed to be a
   stroke somebody made.

   The other worlds use the pool's colour. This one cannot - the whole point of
   the form is that it is ink on paper, and a hundred hues would make it a
   pastel. So the pool's colour is spent on the one thing a Japanese page does
   allow itself: the seal, in cinnabar, on the block being read. Everything
   else is carbon and paper. It is the same rule kept by a different means -
   the identity is still there, it is just been given one place to live.

   And every block draws its poem. A scroll is not a picture with numbers
   beside it, so each block adds one vertical line to the left of its circle,
   newest at the right the way a Japanese page fills, and the paper fills with
   verse as the chain goes on.

   Drawn, not written: the phrases are all authored in advance and the block
   chooses among them with figures it carries - the hour of its epoch, the
   colour of whoever sealed it, how much it held. See `haiku.ts`. The page says
   so out loud rather than letting anyone assume a machine composed verse about
   the chain; and the block's actual figures are still there, in the seal and
   the column, so nobody has to read a poem to learn what happened.

   No animation but the slowest possible drift. Ink does not bounce. */

type Drawn={b:ChainBlock;x:number;y:number;r:number;i:number};

// How many entries the paper holds before the column runs off the bottom.
const SHOWN=6;

export default function WorldSumi({chain,tickers,onPick,lang}:WorldProps){
 const canvas=useRef<HTMLCanvasElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const spots=useRef<Drawn[]>([]);
 const [hover,setHover]=useState<ChainBlock|null>(null);
 const t=lang==='ja'?JA:EN;
 const {ep,tip,blocks,pct,leftDays,seen}=readChain(chain);
 const shown=hover||blocks[0]||null;
 // Japanese numerals on the scroll, plain digits everywhere else.
 const num=(n:number)=>lang==='ja'?kanjiNum(n):n.toLocaleString();
 /* The poems, drawn once for the blocks on the paper rather than on every
    frame - a block's verse cannot change while it is being looked at. */
 const slots=ep?.slots||432000;
 /* A poem is a handful of hashes and three lookups, so it is drawn where it is
    needed rather than remembered. Memoising it would mean depending on the
    ticker map, and a Map arriving as a prop is the one thing the compiler will
    not let a memo hold on to. */
 const verse=(b:ChainBlock):Haiku=>
  haikuFor({height:b.h,epochSlot:b.es,epochSlots:slots,hue:hueOf(b,tickers),tx:b.tx});
 const shownVerse=shown?verse(shown):null;

 useEffect(()=>{
  const c=canvas.current,st=stage.current;
  if(!c||!st)return;
  const ctx=c.getContext('2d');
  if(!ctx)return;
  let raf=0,t0=0;

  /* One enso. The brush starts full and empties as it goes round, so the
     stroke narrows; it wanders off true by a few percent, because a hand does;
     and it lifts before it closes. */
  const enso=(x:number,y:number,r:number,sd:number,alpha:number,ink:string)=>{
   const start=mix32(sd,1)*6.2832;
   const gap=.5+mix32(sd,2)*.7;           // radians of paper left showing
   const span=6.2832-gap;
   const steps=90;
   ctx.strokeStyle=ink;ctx.lineCap='round';
   for(let i=0;i<steps;i++){
    const u=i/steps,a=start+u*span;
    // Loaded at the start, dry at the end, with the wrist wobbling throughout.
    const load=Math.pow(1-u,.65);
    const wob=1+.028*Math.sin(a*3.1+sd)+.016*Math.sin(a*7.3-sd*.7);
    const wid=r*(.05+.13*load);
    const rr=r*wob;
    const a2=start+(i+1)/steps*span;
    ctx.globalAlpha=alpha*(.35+.65*load)*(u>.82?.55+.45*mix32(sd,i):1);
    ctx.lineWidth=wid;
    ctx.beginPath();
    ctx.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);
    ctx.lineTo(x+Math.cos(a2)*rr*(1+.004),y+Math.sin(a2)*rr*(1+.004));
    ctx.stroke();
   }
   ctx.globalAlpha=1;
  };

  /* A column of characters. Kana and kanji stack; a run of Latin - a ticker is
     always Latin - is laid on its side, which is what a vertical column does
     with it. */
  const vtext=(str:string,x:number,y:number,size:number,alpha:number,sd:number)=>{
   ctx.save();
   ctx.fillStyle='#14100f';
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font=`${size}px "Hiragino Mincho ProN","Yu Mincho","Yu Mincho Light",serif`;
   let cy=y,i=0,k=0;
   while(i<str.length){
    if(/[A-Za-z0-9]/.test(str[i])){
     let j=i;while(j<str.length&&/[A-Za-z0-9]/.test(str[j]))j++;
     const run=str.slice(i,j),h=size*run.length*.58;
     ctx.save();
     ctx.translate(x,cy+h/2);ctx.rotate(Math.PI/2);
     ctx.globalAlpha=alpha;ctx.fillText(run,0,0);
     ctx.restore();
     cy+=h+size*.14;i=j;
    }else{
     // The brush does not lay the same weight on every character.
     ctx.globalAlpha=alpha*(.78+.22*mix32(sd,k*3+41));
     ctx.fillText(str[i],x,cy);
     cy+=size*1.08;i++;
    }
    k++;
   }
   ctx.restore();
   return cy;
  };

  const draw=(now:number)=>{
   if(!t0)t0=now;
   const time=(now-t0)/1000;
   const dpr=Math.min(devicePixelRatio||1,2),b=c.getBoundingClientRect();
   const W=Math.max(2,Math.round(b.width*dpr)),H=Math.max(2,Math.round(b.height*dpr));
   if(c.width!==W||c.height!==H){c.width=W;c.height=H}
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,W,H);

   const list=blocks.slice(0,SHOWN);
   const out:Drawn[]=[];
   /* Down the paper, newest first, drifting off the centre line the way a
      column of characters does. The spacing is wider than the largest circle:
      ensos that overlap stop being separate strokes and become a scribble. */
   const cx=W*.82,top=H*.15,step=H*.165;
   // The lines run leftward from the circles, newest nearest them.
   const lineX=W*.66,lineGap=W*.058,lineSize=Math.max(11,Math.min(W,H)*.021);
   list.forEach((blk,i)=>{
    const sd=seedOf(blk);
    const r=Math.min(W,H)*(.072-i*.0055)*(.8+.4*sizeOf(blk.sz));
    const x=cx+(mix32(sd,7)-.5)*W*.05+Math.sin(time*.12+i)*dpr;
    const y=top+i*step;
    if(y-r>H)return;
    out.push({b:blk,x,y,r:Math.max(r,12*dpr),i});
    const fade=i===0?1:Math.max(.34,1-i*.14);
    enso(x,y,Math.max(r,12*dpr),sd,fade,'#14100f');
    /* The transactions are tally dots inside the ring - the count is the
       reading, so they are counted, not textured. */
    const n=Math.min(blk.tx,20);
    for(let k=0;k<n;k++){
     const u=mix32(sd,k*3+21),v=mix32(sd,k*3+22),g=mix32(sd,k*3+23);
     const a=u*6.2832,rr=r*.52*Math.sqrt(v);
     ctx.globalAlpha=fade*(.55+.45*g);
     ctx.fillStyle='#14100f';
     ctx.beginPath();
     ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.92,r*(.035+.03*g),0,6.2832);
     ctx.fill();
    }
    ctx.globalAlpha=1;

    // The block's own poem. Older entries are fainter, the way earlier ink is.
    vtext(haikuFor({height:blk.h,epochSlot:blk.es,epochSlots:slots,hue:hueOf(blk,tickers),tx:blk.tx}).line,lineX-i*lineGap,top-Math.min(W,H)*.055,lineSize,fade*.92,sd);
   });
   spots.current=out;
   raf=requestAnimationFrame(draw);
  };

  const at=(e:PointerEvent)=>{
   const dpr=Math.min(devicePixelRatio||1,2),b=c.getBoundingClientRect();
   const x=(e.clientX-b.left)*dpr,y=(e.clientY-b.top)*dpr;
   for(const s of spots.current)if((x-s.x)**2+(y-s.y)**2<s.r*s.r*1.2)return s;
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
 },[blocks,onPick,tickers,slots]);

 return <div className="w-sumi" ref={stage}>
  {/* The sheet carries the inset; the canvas fills it. A canvas is a replaced
      element, so absolute insets alone leave it at its intrinsic 300x150 and
      the whole column lands in a corner. */}
  <div className="ws-sheet">
   <div className="ws-paper" aria-hidden="true"/>
   <canvas ref={canvas} className="ws-canvas"/>
  </div>

  <div className="ws-title">
   <h2>{t.title}</h2>
   <p>{t.sub}</p>
  </div>

  {/* Read down the right edge, the way the column of ensos is read. */}
  {/* The figures, written the way the rest of the page is written. Arabic
      numerals on a scroll are a different document; these are the same numbers
      every other world shows, said in Japanese. */}
  <dl className="ws-column">
   <div><dt>{t.epoch}</dt><dd>{ep?num(ep.no):'—'}</dd></div>
   <div><dt>{t.height}</dt><dd>{tip?num(tip.height):'—'}</dd></div>
   <div><dt>{t.epBlocks}</dt><dd>{ep?num(ep.blocks):'—'}</dd></div>
   <div><dt>{t.left}</dt><dd>{leftDays.toFixed(2)}</dd></div>
  </dl>

  <div className="ws-progress"><i style={{height:`${(pct*100).toFixed(2)}%`}}/></div>

  {shown&&<button className="ws-seal" type="button" onClick={()=>onPick?.(shown.p)}>
   <i aria-hidden="true">印</i>
   <b>{nameOf(shown,tickers,t.noname,t.unranked)}</b>
   <span>{num(shown.h)} · {t.tx}{num(shown.tx)}</span>
   <em>{t.open}</em>
  </button>}

  {shown&&<p className="ws-yomi"><span>{t.chose}</span>{shownVerse?.yomi}</p>}

  <p className="ws-seen">{t.seen} {seen?seen.toLocaleString():'—'}</p>
 </div>;
}

const JA={
 title:'一筆の円が、ひとつの塊。',
 sub:'筆は墨を使い切ると細くなる。中の点が、その塊の取引。',
 tx:'取引',
 chose:'この句は、塊が選んだ　—　紀のいつ・作った者の色・容れた数から　',
 epoch:'紀', height:'高', epBlocks:'塊', left:'残日',
 open:'このプールへ',noname:'銘なし',unranked:'圏外',seen:'観測',
} as const;
const EN={
 title:'ONE BREATH, ONE BLOCK.',
 sub:'The brush thins as the ink runs out and leaves the paper before it closes. The dots inside are that block’s transactions.',
 tx:'',
 chose:'THE BLOCK CHOSE THIS VERSE — FROM ITS HOUR, ITS SEALER’S COLOUR, AND WHAT IT HELD — ',
 epoch:'EPOCH', height:'HEIGHT', epBlocks:'BLOCKS', left:'DAYS',
 open:'OPEN POOL',noname:'NO TICKER',unranked:'UNRANKED',seen:'OBSERVED',
} as const;
