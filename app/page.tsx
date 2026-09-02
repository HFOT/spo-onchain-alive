'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import BlockArt from './block-art';
import PoolArt,{crestName,crestRomaji,crestMeaning,type ArtData} from './pool-art';
type Parts={reach:number;redundancy:number;independence:number;ownership:number;continuity:number;latency:number};
type Pool={ticker:string;pool:string;score:number;stake:number;sat:number;delegators:number;blocks:number;hist:number[];margin:number;fixedAda:number;entries:number;probed:number;reachable:number;atTip:number;rtt:number|null;severity:string;issues:{code:string}[];rank:number;checked:string;parts?:Parts;shared?:boolean;kesLinked?:boolean};
const fullParts:Parts={reach:35,redundancy:15,independence:25,ownership:10,continuity:10,latency:5};
const fallback:Pool[]=[
 {ticker:'1LOVE',pool:'pool1ft4xjlz9uw0r0ewcgtkgeakqrfc5azxmxwsm5pt94dv67mw4rgd',score:100,stake:55203877,sat:.7106,delegators:1493,blocks:1770,hist:[56.39,56.47,55.29,55.48],margin:.01,fixedAda:340,entries:1,probed:1,reachable:7,atTip:6,rtt:25.44,severity:'low',issues:[{code:'TIP_PARTIAL'}],rank:1,checked:'—',parts:fullParts,shared:false,kesLinked:false},
 {ticker:'UPSTR',pool:'pool1keasvddt9vndl8jyhg204s6kqusv5zgzg3kk3l3g949ew402ahe',score:100,stake:261758,sat:.0034,delegators:70,blocks:10,hist:[.26,.26,.26,.26],margin:.01,fixedAda:170,entries:2,probed:2,reachable:6,atTip:6,rtt:125.12,severity:'none',issues:[],rank:2,checked:'—',parts:fullParts,shared:false,kesLinked:false},
 {ticker:'VAMP',pool:'pool1vs689gkmqtrljtmcwd2690nzqm2yyq23wk2zzx5g0v0gs5ug64a',score:100,stake:15787253,sat:.2032,delegators:39,blocks:472,hist:[15.7,15.72,15.75,15.77],margin:.008,fixedAda:340,entries:4,probed:4,reachable:4,atTip:4,rtt:13.8,severity:'none',issues:[],rank:3,checked:'—',parts:fullParts,shared:false,kesLinked:false},
 {ticker:'ALFA',pool:'pool18qddv82sx8p22uxzdrf0qx9lkewxadlr9ef45kpcf7dzz3n56qv',score:100,stake:23747284,sat:.3057,delegators:943,blocks:607,hist:[16.09,21.28,25.18,25.74],margin:0,fixedAda:170,entries:4,probed:4,reachable:4,atTip:4,rtt:27.38,severity:'none',issues:[],rank:4,checked:'—',parts:fullParts,shared:false,kesLinked:false},
 {ticker:'ST3AK',pool:'pool17ahr5ygy48vpdfnatqn2z4wfu2te4quapk2yx3k50ce6kd7feg0',score:100,stake:51203944,sat:.6591,delegators:10006,blocks:1730,hist:[64.4,55,51.46,52.85],margin:.0199,fixedAda:170,entries:3,probed:3,reachable:3,atTip:3,rtt:29.84,severity:'none',issues:[],rank:5,checked:'—',parts:fullParts,shared:false,kesLinked:false}];
function compact(n:number){return n>=1e6?`${(n/1e6).toFixed(2)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:n.toLocaleString()}
const AXCAP=[35,15,25,10,10,5];
const HUEWORDS:[string,number][]=[['coffee',.07],['cafe',.07],['bean',.07],['brew',.07],['roast',.07],['moka',.07],['choco',.05],['whisky',.09],['beer',.11],['honey',.12],['gold',.13],['aur',.13],['sun',.14],['star',.15],['light',.15],['lumen',.15],['fire',.01],['flame',.01],['burn',.01],['red',.0],['ruby',.0],['blood',.99],['dragon',.02],['orange',.06],['amber',.08],['desert',.1],['sand',.11],['green',.33],['leaf',.33],['forest',.32],['tree',.32],['eco',.34],['farm',.3],['grow',.34],['emerald',.36],['mint',.4],['jade',.38],['bamboo',.31],['ocean',.52],['sea',.52],['aqua',.5],['water',.51],['wave',.5],['tide',.52],['river',.5],['ice',.48],['frost',.48],['cyan',.5],['sky',.57],['blue',.6],['azure',.58],['cloud',.56],['air',.55],['ada',.6],['cardano',.6],['night',.7],['moon',.71],['dark',.72],['deep',.69],['space',.72],['cosmo',.73],['nova',.74],['void',.7],['nebula',.75],['purple',.76],['violet',.77],['amethyst',.78],['royal',.75],['lava',.03],['pink',.9],['rose',.91],['love',.92],['heart',.93],['cherry',.94],['sakura',.9],['bloom',.88],['silver',.55],['steel',.56],['metal',.54],['iron',.55],['stone',.53],['rock',.53]];
/** Stable per-pool numbers used to vary the STRUCTURE of the art, not just its
    strength: symmetry count, twist, curl scale and so on. Without these every
    pool renders the same silhouette in a different colour. */
function poolSig(pool:string,n=6){
 const out:number[]=[];
 for(let k=0;k<n;k++){
  let x=2166136261^(k*2654435761);
  for(let i=0;i<pool.length;i++)x=Math.imul(x^pool.charCodeAt(i),16777619);
  out.push((x>>>0)/4294967295);
 }
 return out;
}
function poolHue(ticker:string,pool:string){const t=(ticker||'').toLowerCase();for(const[w,h]of HUEWORDS)if(t.includes(w))return h;const src=t||pool;let x=2166136261;for(let i=0;i<src.length;i++)x=Math.imul(x^src.charCodeAt(i),16777619);return(x>>>0)/4294967295}
const MOTIFS=['PARTICLE','LINE','STRUCTURE','ORBIT','VOICE','CREST'];
// CREST is still built and still reachable by index; it is only kept out of the
// switcher while its geometry is being worked on.
const SHOWN_MOTIFS=MOTIFS.slice(0,5);
// What each motif is doing with the pool's data, in plain terms.
const MOTIF_NOTE_JA:[string,string][]=[
 ['PARTICLE','委任者ひとりにつき一粒。健全性スコアの六方向へ引かれ、強い軸は群れを遠くに保ち、弱い軸は中心へ落とします。'],
 ['LINE','粒を鎖に連ね、対のあいだの結びつきだけを描きます。流れが両端を引き離すと鎖は伸びて切れ、ブロックが伝わるように光が鎖を走ります。'],
 ['STRUCTURE','水面に落ちる滴。光が生まれ、細かな輪が幾重にも開いて消えていきます。滴ごとに時計が違うので、波紋はばらばらの間合いで重なります。'],
 ['ORBIT','軸ごとにひとつの殻。中心から間隔を置いて並び、その軸の点数が殻を伸縮させます。円として描くことはなく、無数の弧の重なりとして現れます。'],
 ['VOICE','六軸を倍音とみなし、その和が波形、ステークの履歴が音量の起伏になります。光の稜線が波の上を端から端へ走ります。'],
 ['CREST','家紋は、平安の公家が牛車を見分けるために用いはじめ、武家が旗指物に掲げ、やがて庶民にまで広がった一族の徽章です。二万種を超えるといわれる図案のほとんどが植物・動物・自然や器物を主題とし、筆とコンパスだけで、円と円弧の組み合わせとして作図されます。名は「丸に八つ銀杏」のように、輪・数・主題の順に読みます。この紋は、そのプールのオンチェーン記録がコンパスの寸法を決めて描かれたものです。'],
];
const MOTIF_NOTE_EN:[string,string][]=[
 ['PARTICLE','One mote per delegator, pulled toward the six directions of the health score. Strong axes hold their crowd far out; weak ones let it fall back to the centre.'],
 ['LINE','The motes are chained in sequence and only the link between each pair is drawn. The flow drags the ends apart, links stretch and snap, and light runs down the chain the way a block propagates.'],
 ['STRUCTURE','Drops on water. A light lands, fine rings open out of it and fade. Each drop keeps its own clock, so the events overlap at staggered times.'],
 ['ORBIT','One shell per axis, spaced out from the centre and stretched or collapsed by that axis score. The rings are never drawn as circles — they are what a crowd of arcs adds up to.'],
 ['VOICE','The six axes are harmonics. Their sum is the waveform, the stake history is its envelope, and a crest of light runs the length of the trace.'],
 ['CREST','家紋は、平安の公家が牛車を見分けるために用いはじめ、武家が旗指物に掲げ、やがて庶民にまで広がった一族の徽章です。二万種を超えるといわれる図案のほとんどが植物・動物・自然や器物を主題とし、筆とコンパスだけで、円と円弧の組み合わせとして作図されます。名は「丸に八つ銀杏」のように、輪・数・主題の順に読みます。この紋は、そのプールのオンチェーン記録がコンパスの寸法を決めて描かれたものです。六軸が弧の伸びと開き、腰のくびれ、中心の大きさを定め、外輪の太さは健全性スコア、輪の切れ目は共有インフラの印です。'],
];
/** How this pool's own numbers set the character of whatever motif is showing. */
function artReadout(p:Pool){
 const sig=poolSig(p.pool),parts=p.parts||fullParts;
 const axes=[parts.reach,parts.redundancy,parts.independence,parts.ownership,parts.continuity,parts.latency]
  .map((v,i)=>Math.round(Math.max(0,Math.min(1,(v||0)/AXCAP[i]))*100));
 const tempo=(.5+((sig[0]*1.7+sig[3]*2.3)%1)*1.6);
 const hue=Math.round(poolHue(p.ticker,p.pool)*360);
 const flags=[...(p.shared?['SHARED IP']:[]),...(p.kesLinked?['KES LINKED']:[])];
 return{axes,tempo,hue,sig,flags,
  fineness:Math.round(13+sig[2]*17),
  symmetry:3+Math.floor(sig[1]*7),
  spin:sig[5]<.5?'ANTICLOCKWISE':'CLOCKWISE'};
}
type Lang='ja'|'en';
// The crest name itself is never translated: it is a proper name, so it stays in
// kanji with its reading beside it in either language.
const COPY={
 ja:{
  eyebrow:'ステークプール運営者 / オンチェーンの存在',
  intro:['オンチェーン登録とRelay Healthが、固有の質量・構造・運動になる。','SPOを選び、Cardanoを支える生命体を観測してください。'],
  stake:'委任総額',delegators:'委任者',blocks:'生成ブロック / 30エポック',sat:'飽和率',
  health:'リレー健全性',fee:'手数料',
  axes:['到達','冗長','独立','所有','継続','応答'],
  evidence:['到達','登録','共有なし','共有IP','自己鍵','KES連動','先端','無応答','ミリ秒'],
  drawn:'このプールの描かれ方',crestTitle:'このプール固有の家紋',
  colour:'色',tempo:'速度',symmetry:'対称',ripple:'波紋',spin:'回転',flags:'印',
  cw:'右',ccw:'左',none:'なし',meaning:'紋の意',
  emblem:'このプールだけの家紋 · ONE CREST, ONE POOL',
 },
 en:{
  eyebrow:'STAKE POOL OPERATOR / ONCHAIN ENTITY',
  intro:['On-chain registration and relay health become a mass, a structure and a motion of its own.','Choose an operator and watch the thing that keeps Cardano standing.'],
  stake:'ACTIVE STAKE',delegators:'DELEGATORS',blocks:'BLOCKS / 30E',sat:'SATURATION',
  health:'RELAY HEALTH',fee:'FEE',
  axes:['REACH','REDUNDANCY','INDEPENDENCE','OWNERSHIP','CONTINUITY','LATENCY'],
  evidence:['REACHED','REGISTERED','INDEPENDENT','SHARED IP','OWN KEYS','KES LINKED','AT TIP','NO REPLY','MS'],
  drawn:'THIS POOL, DRAWN',crestTitle:'A CREST FOR THIS POOL ALONE',
  colour:'COLOUR',tempo:'TEMPO',symmetry:'SYMMETRY',ripple:'RIPPLE',spin:'SPIN',flags:'FLAGS',
  cw:'CW',ccw:'CCW',none:'NONE',meaning:'THE SUBJECT',
  emblem:'このプールだけの家紋 · ONE CREST, ONE POOL',
 },
} as const;
const AXIS_NAME=['REACH','REDUNDANCY','INDEPENDENCE','OWNERSHIP','CONTINUITY','LATENCY'];
/** The measurement each axis was scored from, so the bar and its evidence sit
    together instead of being repeated in a separate stats block. */
function axisEvidence(p:Pool,lang:Lang){
 const e=COPY[lang].evidence;
 return[
  `${p.reachable}/${p.probed} ${e[0]}`,
  `${p.entries} ${e[1]}`,
  p.shared?e[3]:e[2],
  p.kesLinked?e[5]:e[4],
  `${p.atTip}/${p.probed} ${e[6]}`,
  p.rtt==null?e[7]:`${p.rtt.toFixed(1)} ${e[8]}`,
 ];
}
function artData(p:Pool):ArtData{const b=artPool(p);return{axes:b.axes,hueBase:b.hueBase,histVar:b.histVar,speedMul:b.speedMul,warnAxes:b.warnAxes,hist:p.hist,ticker:p.ticker,score:p.score,sig:poolSig(p.pool)}}
function artPool(p:Pool,motif=0){const count=Math.max(12,Math.min(180,p.delegators));const parts=p.parts||fullParts,axes=[parts.reach,parts.redundancy,parts.independence,parts.ownership,parts.continuity,parts.latency].map((v,i)=>Math.max(0,Math.min(1,(v||0)/AXCAP[i])));const hist=p.hist.length?p.hist:[0];const mean=hist.reduce((a,b)=>a+b,0)/hist.length;const variance=hist.reduce((a,b)=>a+(b-mean)**2,0)/hist.length;const histVar=mean>0?Math.max(0,Math.min(1,Math.sqrt(variance)/mean*4)):0;const speedMul=p.rtt==null?.6:Math.max(.35,Math.min(1.6,1.6-Math.log10(p.rtt+1)*.42));const warnAxes=[...(p.shared?[2]:[]),...(p.kesLinked?[4]:[])];const hueBase=poolHue(p.ticker,p.pool);return{block_hash:p.pool,block_no:p.rank,axes,histVar,speedMul,warnAxes,hueBase,motif,tx_hashes:Array.from({length:count},(_,i)=>`${p.pool}:${i}:${p.hist[i%Math.max(1,p.hist.length)]||0}`),txs:Array.from({length:count},(_,i)=>({tx_hash:`${p.pool}:${i}`,total_output:(p.stake/Math.max(1,count))*1e6,plutus_contracts:i<p.reachable?['relay']:[],assets_minted:i===p.blocks%count?['block']:[]}))}}
async function loadPools():Promise<Pool[]>{const r=await fetch('/api/pools',{cache:'no-store'});if(!r.ok)throw new Error(`pools ${r.status}`);return(await r.json()).pools}
export default function Home(){
 const[pools,setPools]=useState<Pool[]>(fallback),[selected,setSelected]=useState<Pool|null>(null),[query,setQuery]=useState(''),[status,setStatus]=useState<'loading'|'live'|'demo'>('loading'),[frame,setFrame]=useState(true),[motif,setMotif]=useState(0),[lang,setLang]=useState<Lang>('ja');
 const refresh=useCallback(async()=>{try{const next=await loadPools();setPools(next);setSelected(x=>x&&next.find(p=>p.pool===x.pool)||next[0]);setStatus('live')}catch(e){console.error(e);setStatus('demo')}},[]);
 useEffect(()=>{refresh();const id=setInterval(refresh,300000);return()=>clearInterval(id)},[refresh]);
 const t=COPY[lang],note=(lang==='ja'?MOTIF_NOTE_JA:MOTIF_NOTE_EN)[motif],active=selected||pools[0],art=useMemo(()=>artPool(active),[active]),artD=useMemo(()=>artData(active),[active]),readout=useMemo(()=>artReadout(active),[active]),evidence=useMemo(()=>axisEvidence(active,lang),[active,lang]),reach=active.probed?active.reachable/active.probed:0,tip=active.probed?active.atTip/active.probed:0,filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?pools.filter(p=>(p.ticker||'').toLowerCase().includes(q)||p.pool.toLowerCase().includes(q)):pools},[pools,query]);
 return <main><nav><div className="brand">SPO / <span>ALIVE</span></div><div className="nav-right"><div className="lang-switch">{(["ja","en"] as Lang[]).map(l=><button key={l} className={l===lang?"on":""} onClick={()=>setLang(l)}>{l==="ja"?"日本語":"EN"}</button>)}</div><div className={`status ${status}`}><i/>{status==='live'?'RELAY HEALTH · LIVE':status==='loading'?'CONNECTING':'CACHED SAMPLE'}</div></div></nav>
  <section className={`hero spo-hero${motif===5?' washi':''}`} style={{'--pool-hue':`${Math.round(poolHue(active.ticker,active.pool)*360)}deg`} as React.CSSProperties}>{motif===5&&<div className="washi-ink" aria-hidden="true"><span>{crestName(poolSig(active.pool))}</span><b>{active.ticker||'無銘'}</b></div>}<div className="copy web3-copy"><div className="chain-state"><span>● CARDANO MAINNET</span><span>POOL RANK #{active.rank}</span><span>OBSERVED {active.checked||'—'}</span></div>{motif===5
     ?<div className="kamon-emblem"><i/><span>JAPAN</span><b>紋</b><span>KAMON</span><i/><em>{t.emblem}</em></div>
     :<p className="eyebrow">{t.eyebrow}</p>}<h1><span>{active.pool.slice(0,16)}…</span>{active.ticker||'UNTITLED'}<br/>ALIVE.</h1><p className="hashline">{active.pool}</p><p className="intro">{t.intro[0]}<br/>{t.intro[1]}</p><div className="readout">
    <div className="rd-figures">
     <div><b>{compact(active.stake)} ₳</b><span>{t.stake}</span></div>
     <div><b>{active.delegators.toLocaleString()}</b><span>{t.delegators}</span></div>
     <div><b>{active.blocks.toLocaleString()}</b><span>{t.blocks}</span></div>
     <div><b>{(active.sat*100).toFixed(1)}%</b><span>{t.sat}</span></div>
    </div>
    <div className="rd-health">
     <div className="rd-score"><b>{active.score}</b><i>/100</i><span>{t.health}</span>
      <small>{(active.margin*100).toFixed(2)}% + {active.fixedAda} ₳ {t.fee}</small></div>
     <div className="rd-axes">{readout.axes.map((v,i)=>
      <div key={AXIS_NAME[i]}><span>{t.axes[i]}</span><i><b style={{width:`${Math.max(2,v)}%`}}/></i><em>{v}</em><small>{evidence[i]}</small></div>
     )}</div>
    </div>
    <div className="rd-render">
    <p className="rd-title"><span>{motif===5?t.crestTitle:t.drawn}</span><b>{note[0]}</b></p>
    <p className="rd-desc">{note[1]}</p>{motif===5&&<p className="rd-meaning"><span>{t.meaning}</span>{crestMeaning(poolSig(active.pool),lang)}</p>}
    <ul className="rd-chips">
     <li><span>{t.colour}</span><b>{readout.hue}°</b></li>
     <li><span>{t.tempo}</span><b>{readout.tempo.toFixed(2)}×</b></li>
     <li><span>{t.symmetry}</span><b>{readout.symmetry}-FOLD</b></li>
     <li><span>{t.ripple}</span><b>{readout.fineness}</b></li>
     <li><span>{t.spin}</span><b>{readout.spin==='CLOCKWISE'?t.cw:t.ccw}</b></li>
     <li><span>{t.flags}</span><b>{readout.flags.length?readout.flags.join(' · '):t.none}</b></li>
    </ul>
   </div>
   </div>
   </div>
   <div className={`hero-art${frame?' framed':''}`} style={{'--pool-hue':`${Math.round(poolHue(active.ticker,active.pool)*360)}deg`} as React.CSSProperties}><button className="frame-toggle" onClick={()=>setFrame(f=>!f)} title="Toggle frame">{frame?'FRAME ON':'FRAME OFF'}</button><div className="motif-switch">{SHOWN_MOTIFS.map((m,i)=><button key={m} className={i===motif?'on':''} onClick={()=>setMotif(i)}>{m}</button>)}</div><div className="art-color" style={{filter:`saturate(${1.05+Math.min(.55,active.sat)})`}}>{motif===0?<BlockArt block={art} large/>:<PoolArt data={artD} motif={motif}/>}</div>{frame&&<div className="art-plate">{motif===5
     ?<><i className="plate-seal">紋</i><b className="plate-mon">{crestName(poolSig(active.pool))}</b><span className="plate-romaji">{crestRomaji(poolSig(active.pool))}</span><code>{active.ticker||'無銘'} · {active.pool.slice(0,14)}…</code></>
     :<><b>{active.ticker||'UNTITLED'}</b><span>RANK #{active.rank}</span><span>HEALTH {active.score}/100</span><code>{active.pool.slice(0,22)}…</code></>}</div>}{motif!==5&&<div className="art-caption"><span>IDENTITY = FORM</span><span>HEALTH = FLOW</span><span>HISTORY = MEMORY</span></div>}</div>
</section>
  <section className="timeline pool-stream" aria-label="SPO selector"><div className="timeline-head"><span>← STRONG RELAY HEALTH</span><span>SELECT A LIVING POOL</span><span>NETWORK DIVERSITY →</span></div><div className="rail pool-rail">{pools.slice(0,12).map(p=><button key={p.pool} className={`block pool-card ${p.pool===active.pool?'active':''}`} onClick={()=>setSelected(p)}><div className="pool-card-top"><span>#{p.rank}</span><i className={`severity-${p.severity}`}/><b>{p.ticker||'—'}</b></div><div className="pool-stake"><strong>{compact(p.stake)} ₳</strong><span>{(p.sat*100).toFixed(1)}% SAT</span></div><div className="pool-bar"><span style={{width:`${Math.max(2,Math.min(100,p.sat*100))}%`}}/></div><dl><div><dt>HEALTH</dt><dd>{p.score}</dd></div><div><dt>RELAYS</dt><dd>{p.reachable}/{p.probed}</dd></div><div><dt>RTT</dt><dd>{p.rtt==null?'—':`${p.rtt.toFixed(0)}ms`}</dd></div><div><dt>BLOCKS</dt><dd>{p.blocks}</dd></div></dl></button>)}</div></section>
  <section className="pool-directory" aria-label="All stake pools"><div className="directory-head"><div><p>NETWORK DIRECTORY</p><h2>Every pool,<br/>a living artwork.</h2></div><label><span>SEARCH TICKER / POOL ID</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all observed pools…"/><small>{filtered.length.toLocaleString()} / {pools.length.toLocaleString()} POOLS</small></label></div><div className="directory-columns"><span>RANK / POOL</span><span>HEALTH</span><span>RELAY</span><span>STAKE / SAT</span><span>RTT</span><span>BLOCKS</span></div><div className="directory-list">{filtered.map(p=><button key={p.pool} className={p.pool===active.pool?'selected':''} onClick={()=>{setSelected(p);window.scrollTo({top:0,behavior:'smooth'})}}><div className="dir-identity"><em>#{p.rank}</em><i className={`severity-${p.severity}`}/><strong>{p.ticker||'UNTITLED'}</strong><code>{p.pool}</code></div><b>{p.score}<small>/100</small></b><span>{p.reachable}/{p.probed}<small> REACH</small></span><span>{compact(p.stake)} ₳<small>{(p.sat*100).toFixed(1)}% SAT</small></span><span>{p.rtt==null?'—':`${p.rtt.toFixed(0)} ms`}</span><span>{p.blocks.toLocaleString()}</span></button>)}</div></section>
  <footer><span>DATA: CARDANO RELAY HEALTH / ABCDE</span><span>Relay response is a point-in-time observation, not proof of operator uptime.</span></footer></main>
}
