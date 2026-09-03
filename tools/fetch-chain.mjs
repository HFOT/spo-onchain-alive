/* Fetch the chain's current state and write it beside the built site.
   ------------------------------------------------------------------
   The page cannot do this itself. Koios answers a request from anywhere but
   sends no Access-Control-Allow-Origin, so a browser on hfot.github.io is not
   allowed to read the reply - and no keyless Cardano API was found that does
   send one. That restriction is the browser's, not the server's, so the fetch
   happens here, at build time, and the result ships as a file. GitHub Pages
   serves it with `ACAO: *`, which is exactly how the relay-health ranking
   already reaches this site.

   It runs as the first half of `build:static`, so any build ships a feed and
   there is no way to deploy the site without one.

   The cost of the arrangement is freshness: the file is as old as the last
   build, and the page says so rather than implying it is live. A timer on the
   Pages workflow would keep it current; adding one needs a token with the
   `workflow` scope, which is a separate errand.

   Nothing here may throw. A chain that could not be read is a page without a
   block feed, which is a bad afternoon; a build that fails over it takes the
   whole site down, which is worse. */

const API = 'https://api.koios.rest/api/v1';
const BLOCKS = 120;          // about forty minutes of chain
const TIMEOUT = 20000;

async function get(path) {
  const stop = AbortSignal.timeout(TIMEOUT);
  const r = await fetch(`${API}/${path}`, { signal: stop, headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

/* One epoch is 432,000 slots of one second - five days - and about one slot in
   twenty carries a block. Both numbers are protocol constants rather than
   anything measured, but the ring is drawn from them, so they are written into
   the file rather than into the page: if a hard fork ever moves them, the data
   moves and the drawing follows. */
const EPOCH_SLOTS = 432000;

export async function collect() {
  const [tip] = await get('tip');
  const [epoch] = await get(`epoch_info?_epoch_no=${tip.epoch_no}`);
  const blocks = await get(`blocks?limit=${BLOCKS}`);
  return {
    at: new Date().toISOString(),
    source: 'koios',
    tip: {
      epoch: tip.epoch_no,
      epoch_slot: tip.epoch_slot,
      abs_slot: tip.abs_slot,
      height: tip.block_no,
      time: tip.block_time,
    },
    epoch: {
      no: epoch.epoch_no,
      slots: EPOCH_SLOTS,
      blocks: Number(epoch.blk_count) || 0,
      txs: Number(epoch.tx_count) || 0,
      fees: String(epoch.fees ?? ''),
      active_stake: String(epoch.active_stake ?? ''),
      start_time: epoch.start_time,
      end_time: epoch.end_time,
    },
    // Newest first, the order Koios returns them in. Short keys because this
    // is a wire format, not a record anybody reads by hand.
    blocks: blocks.map(b => ({
      h: b.block_height,
      s: b.abs_slot,
      es: b.epoch_slot,
      e: b.epoch_no,
      t: b.block_time,
      tx: b.tx_count,
      sz: b.block_size,
      p: b.pool,
    })),
  };
}

const out = process.argv[2];
if (out) {
  const fs = await import('node:fs');
  let data;
  try {
    data = await collect();
    console.log(`chain: epoch ${data.tip.epoch} · height ${data.tip.height} · ${data.blocks.length} blocks`);
  } catch (e) {
    // Written, not thrown. The page checks `error` and shows the explorer
    // without a feed rather than showing nothing at all.
    data = { at: new Date().toISOString(), source: 'koios', error: String(e?.message || e), blocks: [] };
    console.log(`chain: unavailable (${data.error}) - shipping an empty feed`);
  }
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(`wrote ${out} (${fs.statSync(out).size} bytes)`);
}
