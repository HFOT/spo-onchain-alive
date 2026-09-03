'use client';
import {useEffect,useRef,useState} from 'react';
import {type WorldProps,type ChainBlock,hsl,css,mix32,seedOf,hueOf,sizeOf,nameOf,readChain} from './chain-kit';

/* POP.
   ------------------------------------------------------------------
   Cut paper. Every block is a shape stamped out of coloured card, dropped on
   the page at whatever angle it landed, with a hard black outline and a hard
   shadow behind it. Nothing is shaded, nothing is transparent, nothing floats
   in depth - the instant a highlight appears it stops being a sticker and
   starts being a badly drawn sphere.

   It is not a row. A row is an argument that the blocks are equal and ordered,
   and this world is not making that argument; it is making the one where a
   chain is a pile of stuff a lot of different people made. The newest is the
   biggest and nearest the middle and everything else is scattered around it by
   its own fixed seed, so the scatter is a fact about the blocks rather than a
   shuffle - the same block lands in the same place every time.

   Drawn on a 2D canvas rather than in a shader, because flat fills, thick
   strokes and hard shadows are what that context is for. Fighting a fragment
   shader into producing them would cost more and look worse. */

const SIDES=[3,4,5,6,8];

type Placed={b:ChainBlock;x:number;y:number;r:number;rot:number;spin:number;sides:number;hue:number};

export default function WorldPop({chain,tickers,onPick,lang}:WorldProps){
 const canvas=useRef<HTMLCanvasElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const placed=useRef<Placed[]>([]);
 const [hover,setHover]=useState<ChainBlock|null>(null);
 const t=lang==='ja'?JA:EN;
 const {ep,tip,blocks,pct,leftDays,fill,seen}=readChain(chain);
 const shown=hover||blocks[0]||null;

 useEffect(()=>{
  const c=canvas.current,st=stage.current;
  if(!c||!st)return;
  const ctx=c.getContext('2d');
  if(!ctx)return;
  let raf=0,t0=0;

  /* Where each block lands. Fixed per block, so the page is the same every
     time it is opened, and weighted so the newest sits near the middle and
     large - it is the one being talked about. */
  const layout=(W:number,H:number)=>{
   const out:Placed[]=[];
   const list=blocks.slice(0,22);
   list.forEach((b,i)=>{
    const sd=seedOf(b);
    const age=i/Math.max(1,list.length-1);        // 0 newest
    const u=mix32(sd,1),v=mix32(sd,2),w=mix32(sd,3),g=mix32(sd,4);
    // Newest at the centre, older pushed outward on its own bearing.
    const bearing=u*6.2832;
    const reach=Math.pow(age,.6)*.62+.1;
    /* The pile sits right of centre and low. The heading owns the top left,
       and a shape landing on a sentence is a shape that has beaten the page. */
    const x=W*(.58+Math.cos(bearing)*reach*.92)+(v-.5)*W*.05;
    const y=H*(.56+Math.sin(bearing)*reach*.78)+(w-.5)*H*.06;
    const big=Math.min(W,H)*(.125-age*.062)*(.74+.46*sizeOf(b.sz));
    out.push({b,x,y,r:Math.max(Math.min(W,H)*.035,big),
      rot:g*6.2832,spin:(g-.5)*.24,
      sides:SIDES[Math.floor(mix32(sd,5)*SIDES.length)],hue:hueOf(b,tickers)});
   });
   // Oldest first, so the newest is stamped on top of the pile.
   return out.reverse();
  };

  const poly=(x:number,y:number,r:number,sides:number,rot:number)=>{
   ctx.beginPath();
   for(let i=0;i<sides;i++){
    const a=rot+i/sides*6.2832;
    const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
    if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
   }
   ctx.closePath();
  };

  const draw=(now:number)=>{
   if(!t0)t0=now;
   const time=(now-t0)/1000;
   const dpr=Math.min(devicePixelRatio||1,2),b=st.getBoundingClientRect();
   const W=Math.max(2,Math.round(b.width*dpr)),H=Math.max(2,Math.round(b.height*dpr));
   if(c.width!==W||c.height!==H){c.width=W;c.height=H}
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,W,H);
   const P=placed.current=layout(W,H);

   // Confetti. Fixed places, so it is wallpaper rather than noise that jitters.
   for(let i=0;i<70;i++){
    const u=mix32(0x9e37,i*3+1),v=mix32(0x9e37,i*3+2),g=mix32(0x9e37,i*3+3);
    const x=u*W,y=(v*H+time*8*(0.3+g))%H,s=(2+g*5)*dpr;
    ctx.fillStyle=css(hsl(g,.85,.62),.5);
    ctx.beginPath();ctx.arc(x,y,s,0,6.2832);ctx.fill();
   }

   for(const p of P){
    const rot=p.rot+time*p.spin;
    // The hard shadow. Offset, opaque, no blur - a sticker on a page, not an
    // object in a room.
    ctx.fillStyle='rgba(24,12,40,.9)';
    poly(p.x+8*dpr,p.y+9*dpr,p.r,p.sides,rot);ctx.fill();
    ctx.fillStyle=css(hsl(p.hue,.9,.62));
    poly(p.x,p.y,p.r,p.sides,rot);ctx.fill();
    ctx.lineWidth=Math.max(2,p.r*.07);
    ctx.strokeStyle='#170d24';ctx.stroke();
    // A second, smaller shape inside, so a block is never one flat lozenge.
    ctx.fillStyle=css(hsl((p.hue+.5)%1,.92,.7));
    poly(p.x,p.y,p.r*.44,p.sides,-rot*1.6);ctx.fill();
    ctx.lineWidth=Math.max(1.5,p.r*.045);ctx.stroke();

    /* The transactions, bouncing round the rim. One dot each, so a block with
       nine of them has nine and an empty one is honestly bare. */
    const n=Math.min(p.b.tx,24);
    for(let i=0;i<n;i++){
     const sd=seedOf(p.b),k=mix32(sd,i*2+11),m=mix32(sd,i*2+12);
     const a=k*6.2832+time*(.5+m*.8)*(i%2?1:-1);
     const rr=p.r*(.66+.24*Math.sin(time*(1.2+m)+i));
     const dx=p.x+Math.cos(a)*rr,dy=p.y+Math.sin(a)*rr;
     const s=p.r*.1*(.6+m*.9);
     ctx.fillStyle=css(hsl((p.hue+.32+m*.2)%1,.95,.66));
     ctx.beginPath();ctx.arc(dx,dy,s,0,6.2832);ctx.fill();
     ctx.lineWidth=Math.max(1,s*.34);ctx.strokeStyle='#170d24';ctx.stroke();
    }

    // The height, stamped across the shape.
    ctx.save();
    ctx.translate(p.x,p.y+p.r+16*dpr);
    ctx.font=`800 ${Math.max(9,p.r*.2)}px ui-rounded,"Hiragino Maru Gothic ProN",system-ui,sans-serif`;
    ctx.textAlign='center';ctx.lineJoin='round';
    ctx.lineWidth=Math.max(3,p.r*.06);ctx.strokeStyle='#170d24';
    ctx.strokeText(String(p.b.h),0,0);
    ctx.fillStyle='#fff';ctx.fillText(String(p.b.h),0,0);
    ctx.restore();
   }
   raf=requestAnimationFrame(draw);
  };

  const at=(e:PointerEvent)=>{
   const dpr=Math.min(devicePixelRatio||1,2),b=c.getBoundingClientRect();
   const x=(e.clientX-b.left)*dpr,y=(e.clientY-b.top)*dpr;
   // Topmost first, which is the end of the painted order.
   for(let i=placed.current.length-1;i>=0;i--){
    const p=placed.current[i];
    if((x-p.x)**2+(y-p.y)**2<p.r*p.r)return p;
   }
   return null;
  };
  const move=(e:PointerEvent)=>{const p=at(e);c.style.cursor=p?'pointer':'default';setHover(p?p.b:null)};
  const click=(e:PointerEvent)=>{const p=at(e);if(p)onPick?.(p.b.p)};
  c.addEventListener('pointermove',move,{passive:true});
  c.addEventListener('click',click);
  raf=requestAnimationFrame(draw);
  return()=>{
   cancelAnimationFrame(raf);
   c.removeEventListener('pointermove',move);
   c.removeEventListener('click',click);
  };
 },[blocks,tickers,onPick]);

 return <div className="w-pop" ref={stage}>
  <canvas ref={canvas} className="wp-canvas"/>
  <div className="wp-head">
   <h2>{t.title}</h2>
   <p>{t.sub}</p>
  </div>
  <div className="wp-epoch">
   <b>EPOCH {ep?.no??'—'}</b>
   <i><em style={{width:`${(pct*100).toFixed(2)}%`}}/></i>
   <span>{(pct*100).toFixed(1)}% · {t.left(leftDays)}</span>
  </div>
  <div className="wp-cards">
   <div><b>{tip?tip.height.toLocaleString():'—'}</b><span>{t.height}</span></div>
   <div><b>{ep?ep.blocks.toLocaleString():'—'}</b><span>{t.epBlocks}</span></div>
   <div><b>{ep?ep.txs.toLocaleString():'—'}</b><span>{t.epTxs}</span></div>
   <div><b>{(fill*100).toFixed(1)}%</b><span>{t.fill}</span></div>
  </div>
  {shown&&<button className="wp-pick" type="button" onClick={()=>onPick?.(shown.p)}>
   <em>{shown.tx} tx</em>
   <b>{nameOf(shown,tickers,t.noname,t.unranked)}</b>
   <span>{t.open}</span>
  </button>}
  <p className="wp-seen">{t.seen} {seen?seen.toLocaleString():'—'}</p>
 </div>;
}

const JA={
 title:'ブロックは、みんな別のかたち。',
 sub:'ひとつひとつを、つくった人の色で。さわると、そのプールへ。',
 height:'ブロック高',epBlocks:'このEPのブロック',epTxs:'このEPのtx',fill:'スロット充填率',
 open:'このプールへ',noname:'Ticker未設定',unranked:'ランキング外',seen:'観測',
 left:(d:number)=>`のこり ${d.toFixed(2)} 日`,
} as const;
const EN={
 title:'EVERY BLOCK, A DIFFERENT SHAPE.',
 sub:'Each one in the colour of whoever made it. Touch one to open that pool.',
 height:'HEIGHT',epBlocks:'BLOCKS THIS EP',epTxs:'TX THIS EP',fill:'SLOTS FILLED',
 open:'OPEN POOL',noname:'NO TICKER',unranked:'UNRANKED',seen:'OBSERVED',
 left:(d:number)=>`${d.toFixed(2)} DAYS LEFT`,
} as const;
