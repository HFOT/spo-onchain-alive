/* A pool's colour.
   ------------------------------------------------------------------
   Every drawing on this site tints a pool the same way, at every scale - the
   galaxy, the block that pool produced, its own artwork - so the mapping lives
   in one place rather than being repeated wherever a colour is needed.

   A ticker that says something about colour is taken at its word; anything else
   is hashed. It is arbitrary either way, but a pool called OCEAN coming out
   blue is a small kindness, and the hash keeps every other pool distinct and
   the same colour on every visit. */
const HUEWORDS:[string,number][]=[['coffee',.07],['cafe',.07],['bean',.07],['brew',.07],['roast',.07],['moka',.07],['choco',.05],['whisky',.09],['beer',.11],['honey',.12],['gold',.13],['aur',.13],['sun',.14],['star',.15],['light',.15],['lumen',.15],['fire',.01],['flame',.01],['burn',.01],['red',.0],['ruby',.0],['blood',.99],['dragon',.02],['orange',.06],['amber',.08],['desert',.1],['sand',.11],['green',.33],['leaf',.33],['forest',.32],['tree',.32],['eco',.34],['farm',.3],['grow',.34],['emerald',.36],['mint',.4],['jade',.38],['bamboo',.31],['ocean',.52],['sea',.52],['aqua',.5],['water',.51],['wave',.5],['tide',.52],['river',.5],['ice',.48],['frost',.48],['cyan',.5],['sky',.57],['blue',.6],['azure',.58],['cloud',.56],['air',.55],['ada',.6],['cardano',.6],['night',.7],['moon',.71],['dark',.72],['deep',.69],['space',.72],['cosmo',.73],['nova',.74],['void',.7],['nebula',.75],['purple',.76],['violet',.77],['amethyst',.78],['royal',.75],['lava',.03],['pink',.9],['rose',.91],['love',.92],['heart',.93],['cherry',.94],['sakura',.9],['bloom',.88],['silver',.55],['steel',.56],['metal',.54],['iron',.55],['stone',.53],['rock',.53]];

export function poolHue(ticker:string,pool:string){const t=(ticker||'').toLowerCase();for(const[w,h]of HUEWORDS)if(t.includes(w))return h;const src=t||pool;let x=2166136261;for(let i=0;i<src.length;i++)x=Math.imul(x^src.charCodeAt(i),16777619);return(x>>>0)/4294967295}
