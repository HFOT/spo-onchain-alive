/* A block chooses its poem.
   ------------------------------------------------------------------
   Not writes one - chooses. Every phrase here was authored in advance and
   every phrase is fixed; what the block supplies is which three of them go
   together, and it supplies that from figures it actually carries:

     the opening five  <- where in the epoch it fell, from its slot
     the middle seven  <- the colour of whoever sealed it, from the same hue
                          every other world tints that pool with
     the closing five  <- what it held, from its transaction count

   So the poem is not a decoration laid over the data, it is an index into a
   book, and the data is the index. The same block draws the same poem on every
   visit and on every machine, the way its crest and its colour do. A block
   that held nothing gets a closing phrase that says so; there is no line here
   that flatters a block for being empty, because one in five of them is.

   That is the whole claim, and the page states it rather than letting a reader
   assume a machine wrote verse about the chain. It did not. It picked.

   Mora counts are 5-7-5 read aloud, with the reading kept beside each phrase
   because the kanji spelling does not show it. */

/** 上五 - the hour of the epoch, from how far through its five days the block
    fell. Twelve divisions, so the whole cycle is walked in order. */
const OPEN:[string,string][]=[
 ['暁の','あかつきの'],        ['明け方の','あけがたの'],
 ['朝ぼらけ','あさぼらけ'],    ['日は昇り','ひはのぼり'],
 ['真昼間の','まひるまの'],    ['中空に','なかぞらに'],
 ['傾きて','かたむきて'],      ['夕影に','ゆうかげに'],
 ['暮れ残る','くれのこる'],    ['宵闇に','よいやみに'],
 ['夜更けまで','よふけまで'],  ['星流れ','ほしながれ'],
];

/** 中七 - the colour of the pool that sealed it. The hue is the same number
    the galaxy and the bubbles tint that pool with, so a pool named for the
    sea gets the sea, and keeps it in every world. */
const MIDDLE:[string,string][]=[
 ['紅の色','くれないのいろ'],    ['炎を宿し','ほのおをやどし'],
 ['土の匂いと','つちのにおいと'],['金のひかりに','きんのひかりに'],
 ['緑の風に','みどりのかぜに'],  ['若葉のかげに','わかばのかげに'],
 ['海の深さに','うみのふかさに'],['青に染まりて','あおにそまりて'],
 ['空の青さを','そらのあおさを'],['闇を纏いて','やみをまといて'],
 ['紫けぶり','むらさきけぶり'],  ['花びらのごと','はなびらのごと'],
];

/** 下五 - what it held. Four bands, three phrases each, because a block with
    nothing in it and a block with forty transactions are not the same event
    and should not be able to draw the same closing line. */
const CLOSE:[string,string][][]=[
 // nothing at all - one block in five
 [['空のまま','からのまま'],['何も無し','なにもなし'],['風に消ゆ','かぜにきゆ']],
 // one or two
 [['一つだけ','ひとつだけ'],['ささやかに','ささやかに'],['ぽつりとぞ','ぽつりとぞ']],
 // a handful
 [['数えらる','かぞえらる'],['満ちてゆく','みちてゆく'],['残りけり','のこりけり']],
 // a crowd
 [['ひしめきて','ひしめきて'],['溢れたり','あふれたり'],['あまた載せ','あまたのせ']],
];

export type Haiku={open:string;middle:string;close:string;yomi:string;line:string};

/** Which of the closing bands a transaction count falls in. */
const band=(tx:number)=>tx===0?0:tx<=2?1:tx<=8?2:3;

/** Stable, and stable across machines: the same block is the same poem. */
function pick(seed:number,salt:number,len:number){
 let x=Math.imul(seed^(salt+0x9e3779b9),2654435761);
 x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;
 return (x>>>0)%len;
}

export function haikuFor(o:{height:number;epochSlot:number;epochSlots:number;hue:number;tx:number}):Haiku{
 const seed=o.height>>>0;
 // The hour: twelve divisions of the epoch, walked in order rather than hashed,
 // so a block late in an epoch really does get a late phrase.
 const hour=Math.min(OPEN.length-1,
   Math.floor(Math.max(0,Math.min(.999,o.epochSlot/Math.max(1,o.epochSlots)))*OPEN.length));
 // The colour: twelve families around the wheel, from the same hue as ever.
 const colour=Math.min(MIDDLE.length-1,Math.floor(((o.hue%1)+1)%1*MIDDLE.length));
 const shelf=CLOSE[band(o.tx)];
 const close=shelf[pick(seed,7,shelf.length)];
 const a=OPEN[hour],b=MIDDLE[colour];
 return{
  open:a[0],middle:b[0],close:close[0],
  yomi:`${a[1]} ${b[1]} ${close[1]}`,
  line:`${a[0]}　${b[0]}　${close[0]}`,
 };
}
