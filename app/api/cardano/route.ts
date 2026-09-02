import {NextResponse} from 'next/server';
const API='https://api.koios.rest/api/v1',TTL=45_000;
type Payload={blocks:unknown[];source:string;fetched_at:number;stale?:boolean};
let cached:Payload|null=null,inflight:Promise<Payload>|null=null;
async function post(path:string,body:unknown){const r=await fetch(`${API}/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json()}
async function collect():Promise<Payload>{
 const tipR=await fetch(`${API}/tip`,{cache:'no-store'});if(!tipR.ok)throw new Error(`tip: ${tipR.status}`);const tip=(await tipR.json())[0];
 let hash=tip.hash;const infos=[];
 for(let i=0;i<8&&hash;i++){const info=(await post('block_info',{_block_hashes:[hash]}))[0];infos.push(info);hash=info.parent_hash}
 const blockHashes=infos.map(x=>x.hash),rows=await post('block_txs',{_block_hashes:blockHashes});
 const txHashes=rows.map((x:{tx_hash:string})=>x.tx_hash),txs=txHashes.length?await post('tx_info',{_tx_hashes:txHashes}):[];
 const byBlock=new Map<string,unknown[]>();for(const tx of txs){const key=tx.block_hash;byBlock.set(key,[...(byBlock.get(key)||[]),tx])}
 const blocks=infos.map((info,i)=>{const blockTxs=byBlock.get(info.hash)||[];return{...info,block_hash:info.hash,block_no:info.block_no??info.block_height,previous_block:info.parent_hash,tx_hashes:blockTxs.map((x:any)=>x.tx_hash),txs:blockTxs,live:i===0}});
 return{blocks,source:'koios',fetched_at:Date.now()};
}
export async function GET(){
 if(cached&&Date.now()-cached.fetched_at<TTL)return NextResponse.json(cached,{headers:{'cache-control':'no-store'}});
 try{inflight??=collect();cached=await inflight;return NextResponse.json(cached,{headers:{'cache-control':'no-store'}})}catch(error){if(cached)return NextResponse.json({...cached,stale:true},{headers:{'cache-control':'no-store'}});return NextResponse.json({error:error instanceof Error?error.message:'Cardano API error'},{status:502})}finally{inflight=null}
}
