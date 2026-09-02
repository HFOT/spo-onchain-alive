// Where the pool records come from.
//
// This used to sit behind an API route because the page was server-rendered.
// It does not need to: GitHub Pages serves the relay-health page with
// `Access-Control-Allow-Origin: *`, so the browser can read it directly, and
// dropping the server hop is what lets the whole site build to static files.
//
// The published page carries its dataset inline as `const data=[...]`, so the
// array is lifted straight out of the HTML. That is a contract with someone
// else's build, so it is checked rather than trusted.

export const RELAY_HEALTH='https://hfot.github.io/cardano-relay-health/';

const MARK='const data=[';

export function extractPools(html:string):unknown[]{
 const start=html.indexOf(MARK);
 if(start<0)throw new Error('relay health: dataset not found');
 const end=html.indexOf('];',start);
 if(end<0)throw new Error('relay health: dataset not terminated');
 const json=html.slice(start+MARK.length-1,end+1);
 const pools=JSON.parse(json);
 if(!Array.isArray(pools)||!pools.length)throw new Error('relay health: dataset empty');
 return pools;
}

export async function fetchPools():Promise<unknown[]>{
 const r=await fetch(RELAY_HEALTH,{cache:'no-store'});
 if(!r.ok)throw new Error(`relay health ${r.status}`);
 return extractPools(await r.text());
}
