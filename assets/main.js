/* Glue code – ties everything together ----------------------------------*/
import { els, showSidebarSkeleton, showMainSkeleton } from './ui.js';
import * as api from './api.js';
import * as chart from './chart.js';
import { timeAgo, getPairFromHash, setPairHash, formatPrice } from './utils.js';
import { TOKEN_CACHE } from './api.js';
let currencyUsdPrice = 0;    // USD per Xian
const liveRows = [];
const rowH = 56;              // px – real height of 1 sidebar row

/* ─── search state ────────────────────────────────────────── */
let searchTerm = '';          // current lowercase query
let allPairs = [];          // master list (set in init)
let hasRealData = false; // top-level flag
const hydratingContracts = new Set();          // in-progress fetches
const hydratedPairs = new Set();               // pair.pair → fully hydrated

let currentTradesWs = null;  // ← track the active socket
let currentPriceChangeWs = null;
let currentVolumeWs = null;
let currentReservesWs = null;
let currentPairsWs = null;   // ← NEW: sidebar pairs feed
let currentCandlesWs = null;  // ← NEW: live candles feed
const ivMs = 5 * 60 * 1000; // 5 minutes in ms

/* --------------------------- Start-up -----------------------------------*/
document.addEventListener('DOMContentLoaded', init);
const sb = document.getElementById('sidebar');
function toggleSidebar() {
  sb.classList.toggle('-translate-x-full');
  sb.classList.toggle('pointer-events-none');
}

document.getElementById('hamburger').onclick = toggleSidebar;
document.getElementById('closeSidebar').onclick = toggleSidebar;

function blinkLive() {
  const dot = document.getElementById('live-dot');
  if (dot) dot.classList.toggle('opacity-0');
}

function tickUpdated() {
  const el = document.querySelector('#last-updated time');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString();
}

async function init() {
  showSidebarSkeleton();
  showMainSkeleton();
  els.pairsScroller.addEventListener('scroll', updateVisibleRows);
  const ro = new ResizeObserver(updateVisibleRows);
  ro.observe(els.pairsScroller);

  document.getElementById('pairSearch')
    .addEventListener('input', onSearch);

  currencyUsdPrice = (await api.getCurrencyPrice()).priceNow;

  // 2) start polling every minute
  setInterval(async () => {
    try {
      const { priceNow } = await api.getCurrencyPrice();
      if (priceNow != null) currencyUsdPrice = priceNow;
    } catch (err) {
      console.warn('Failed to refresh XIAN→USD rate', err);
    }
  }, 60_000);
  
  const rawPairs = (await api.getPairs({ limit: 1031 })).pairs; // already sorted DESC
  allPairs = normalisePairs(rawPairs);

  renderSidebar(allPairs);                         // first paint

  // ── NEW: subscribe to live all-pairs feed
  currentPairsWs = api.subscribePairs({
    onData: payload => {
    const live = normalisePairs(payload.pairs || []);
    allPairs = live;

    // For each incoming pair update…
    live.forEach(p => {
      // 1) Find the old in-memory model
      const old = liveRows.find(r => r.id === p.pair);
      if (old) {
        // 2) Only update vol/price if they’ve changed
        const newVol = toUsdVol(p);
        const newPct = p.pricePct24h ?? 0;
        if (old.vol !== newVol || old.pct !== newPct) {
          // 3) Mutate your liveRows state
          old.vol = newVol;
          old.pct = newPct;
          // 4) Re-draw that one button
          refreshSidebarRow(p);
        }
      } else if (matchesSearch(p)) {
        // It’s new: insert it
        upsertRow(p);
      }
    });

    // Finally, adjust the scroll pad & visible window
    updateVisibleRows();
  },
    onError: err => console.error('Pairs WS error', err),
    onOpen: () => console.log('Pairs WS connected'),
  });

  // deep-link support
  const maybeId = getPairFromHash();
  if (maybeId && allPairs.some(p => p.pair === maybeId)) {
    selectPair(maybeId);
  } else if (allPairs.length) {
    selectPair(allPairs[0].pair);
  }

  tickUpdated(); // initial time stamp
  setInterval(tickUpdated, 1_000);     // every second
}

/* -------------------------- Sidebar ------------------------------------*/
function normalisePairs(pairs) {
  return pairs.map(p => (p.token0 === 'con_usdc' && p.token1 === 'currency')
    ? { ...p, token0: 'currency', token1: 'con_usdc', pair: '1' }
    : p);
}
async function hydrateMetadataIfNeeded(pair) {
  const key = pair.pair;

  // Already done? We're good.
  if (hydratedPairs.has(key)) return;

  // Wait for both tokens
  await Promise.all(
    [pair.token0, pair.token1].map(async (token) => {
      if (TOKEN_CACHE[token]) return;

      // Dedup concurrent fetches
      if (!hydratingContracts.has(token)) {
        hydratingContracts.add(token);
        try {
          const meta = await api.fetchTokenMeta(token);
          TOKEN_CACHE[token] = meta;
        } catch (err) {
          console.warn(`❌ Token metadata failed for ${token}`, err);
        } finally {
          hydratingContracts.delete(token);
        }
      }

      // Wait for another ongoing fetch to complete
      while (!TOKEN_CACHE[token]) {
        await new Promise(r => setTimeout(r, 100)); // poll
      }
    })
  );

  // At this point: both token0 + token1 are in cache
  if (!hydratedPairs.has(key)) {
    hydratedPairs.add(key);
    refreshSidebarRow(pair); // trigger UI update
  }
}




function refreshSidebarRow(pair) {
  const idx = liveRows.findIndex(r => r.id === pair.pair);
  if (idx === -1) return;

  const newBtn = makePairButton(pair, toUsdVol(pair));
  liveRows[idx].btn = newBtn;

  // Replace the old button in DOM if it exists
  const oldBtn = els.rowHost.querySelector(`button[data-pair="${pair.pair}"]`);
  if (oldBtn) oldBtn.replaceWith(newBtn);
}


function renderSidebar(pairs) {
  hasRealData = true;
  pairs.forEach(upsertRow);
  updateVisibleRows(); // only safe now
}

function upsertRow(pair) {
  if (!matchesSearch(pair)) return;   // skip if filtered out
  const volUSD = toUsdVol(pair);      // ← helper below

  /* 1) de-duplicate ---------------------------------------------------- */
  const oldIdx = liveRows.findIndex(r => r.id === pair.pair);
  if (oldIdx !== -1) {
    liveRows.splice(oldIdx, 1);          // remove old record only
  }
  /* already volume-sorted from the API → just push in order */
  const btn = makePairButton(pair, volUSD);
  liveRows.push({ id: pair.pair, vol: volUSD, btn });

  /* 4) repaint the visible window ------------------------------------- */
  updateVisibleRows();
}


function makePairButton(p, volUSD) {
  const pct = p.pricePct24h ?? 0;

  const meta0 = TOKEN_CACHE[p.token0] ?? { symbol: p.token0, logo: '' };
  const meta1 = TOKEN_CACHE[p.token1] ?? { symbol: p.token1, logo: '' };
  const t0 = meta0.symbol;
  const t1 = meta1.symbol;

  const btn = document.createElement('button');
  btn.className = `
    flex flex-col items-start w-full px-4 py-2 text-left
    hover:bg-white/5 active:bg-white/10 transition`;
  btn.innerHTML = `
    <div class="flex items-center justify-between w-full">
      <span class="flex items-center gap-2">
        <img src="${meta0.logo}" width="20" height="20"
             onerror="this.onerror=null;this.src='./assets/ph.png';" />
        <span>${t0} / ${t1}</span>
      </span>
      <span class="text-xs ${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        ${pct.toFixed(2)}%
      </span>
    </div>
    <div class="text-xs text-gray-400 mt-1.5">
      $${volUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} vol
    </div>`;
  btn.setAttribute('data-pair', p.pair);

  btn.onclick = () => {
    selectPair(p.pair);
    // ── NEW ── only on <768 px
    if (window.matchMedia('(max-width: 767px)').matches) {
      toggleSidebar();                // reuse your existing helper
    }
  }
  return btn;
}

function toUsdVol(p) {
  /* token-1 side is always the ‘dollar’ side in the new payload */
  return (p.volume24h ?? 0) * currencyUsdPrice;
}

/* --------------------------- Pair page ----------------------------------*/
async function selectPair(pairId) {
  setPairHash(pairId);  // update URL hash
  showMainSkeleton();

  /* 1) basic info --------------------------------------------------------*/
  let { token0, token1 } = await api.getPair(pairId);
  let denomPrice = 1, denomVol = 1, denomTrades = 1, chartDenom = '1';
  if (token0 === 'con_usdc' && token1 === 'currency') {
    [token0, token1] = [token1, token0];
    denomPrice = 0; chartDenom = '0';
  }

  const meta0 = await api.fetchTokenMeta(token0);
  const meta1 = await api.fetchTokenMeta(token1);

  /* pair logo -------------------------------------------------------- */
  els.pairLogo.src = meta0.logo ||                          // main logo
    './assets/ph.png'; // 1×1 GIF fallback
  els.pairLogo.onerror = () => {                            // graceful 404
    els.pairLogo.src =
      './assets/ph.png';
  };

  els.pairName.textContent = `${meta0.symbol} / ${meta1.symbol}`;

  /* 2) concurrent data ---------------------------------------------------*/
  const [priceD, volD, tradesD, resD] = await Promise.all([
    api.get24hPriceChange(pairId, denomPrice),
    api.get24hVolume(pairId, denomVol),
    api.getPairTrades(pairId, { token: denomTrades }),
    api.getPairReserves(pairId),
  ]);

  /* 3) stats bar initial paint -------------------------------------------*/
  const priceNow = priceD.priceNow ?? priceD.price ?? 0;
  const pct = priceD.changePct ?? priceD.percentChange ?? 0;
  const vol24h = volD.volume24h * currencyUsdPrice;
  const usdLiq = Number(resD.reserve1 || 0) * currencyUsdPrice * 2;

  function paintPrice(price, pct) {
    if (price == null || pct == null) return;
    els.price.textContent = `${formatPrice(price)} ${meta1.symbol}`;
    els.delta.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
    els.delta.className = `${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-medium`;
    els.priceM.textContent = els.price.textContent;
    
    els.deltaM.textContent = els.delta.textContent;
    els.deltaM.classList.remove('text-emerald-400', 'text-rose-400');
    els.deltaM.classList.add(`${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`);
  }

  function paintVolume(vol) {
    if (vol == null) return;
    els.volume.textContent = `$${vol.toLocaleString()}`;
    els.volumeM.textContent = els.volume.textContent;
  }

  function paintLiquidity(liq) {
    if (liq == null) return;
    els.liquidity.textContent = `$${liq.toLocaleString(undefined, {
      minFractionDigits: 2, maxFractionDigits: 2
    })}`;
    els.liquidityM.textContent = els.liquidity.textContent;
  }
  paintPrice(priceNow, pct);
  paintVolume(vol24h);
  paintLiquidity(usdLiq);

  /* 5) chart -------------------------------------------------------------*/
  chart.initEmptyChart();
  await chart.loadInitialCandles(pairId, chartDenom);
  document.querySelector('.tf-btn.active')?.classList.remove('active');
document.querySelector('.tf-btn[data-tf=\"5m\"]')?.classList.add('active');

    // ── NEW: back-fill any missing 5m bars up to the current slot
  (function fillToNow() {
    const bars = chart.getAllBars();       // assume this gives you the full array
    for (let i = 1; i < bars.length; i++) {
      const prevTs = bars[i-1].time * 1000;
      const currTs = bars[i  ].time * 1000;
      const missed = Math.floor((currTs - prevTs) / ivMs) - 1;
      for (let j = 1; j <= missed; j++) {
        chart.upsertLastCandle({
          t:      prevTs + ivMs * j,
          open:   bars[i-1].close,
          high:   bars[i-1].close,
          low:    bars[i-1].close,
          close:  bars[i-1].close,
          volume: 0,
        });
      }
    }
    // and fill the “incomplete” current interval
    const last = chart.getLastBar();
    const nextSlot = Math.floor(Date.now() / ivMs) * ivMs;
    if (nextSlot > last.time * 1000) {
      chart.upsertLastCandle({
        t:      nextSlot,
        open:   last.close,
        high:   last.close,
        low:    last.close,
        close:  last.close,
        volume: 0,
      });
    }
    chart.getChartInstance?.().timeScale().fitContent?.();   // ← helper below
  })();


  const tradeBoxState = {
    id: pairId,
    sym0: meta0.symbol,
    sym1: meta1.symbol,
    contract0: token0,
    contract1: token1,
    price: priceNow,
    reserve0: resD.reserve0 || 0,
    reserve1: resD.reserve1 || 0,
  };

  // initial trade-box render
  updateTradeBox({
    ...tradeBoxState,
    price: `${formatPrice(tradeBoxState.price)} ${meta1.symbol}`,
    balance0: '—',
    balance1: '—',
    currentPrice: tradeBoxState.price,
    resetInputs: true,
  });

  refreshBalanceLine();

  /* 6) tear down any old sockets -----------------------------------------*/
  [currentPriceChangeWs, currentVolumeWs, currentReservesWs, currentCandlesWs].forEach(ws => {
    if (ws) ws.close();
  });

  /* 7) wire up live updates ----------------------------------------------*/
  currentPriceChangeWs = api.subscribePairPriceChange24h(pairId, denomPrice, {
    onOpen: () => {
    console.log('Price WS open for', pairId);
    document.getElementById('live-dot')
      .classList.add('connected');
  },
    onError: err => {
      console.error('Price WS error', err);
      document.getElementById('live-dot')
        .classList.remove('connected');
    },
    onData: d => {
      const newPrice = d.priceNow ?? d.price;
      const newPct   = d.changePct ?? d.percentChange ?? 0;
      tradeBoxState.price = newPrice;
      paintPrice(newPrice, newPct);
      // let updateTradeBox format + append symbol itself
      updateTradeBox({
        ...tradeBoxState,
        currentPrice: newPrice,
      });
    }
  });

  currentVolumeWs = api.subscribePairVolume24h(pairId, denomVol, {
    onData: d => {
      // volume display only
      paintVolume(d.volume24h * currencyUsdPrice);
    }
  });


  currentReservesWs = api.subscribePairReserves(pairId, {
    onData: d => {
      tradeBoxState.reserve0 = d.reserve0 || 0;
      tradeBoxState.reserve1 = d.reserve1 || 0;
      updateTradeBox({
        ...tradeBoxState,
        currentPrice: tradeBoxState.price,
      });
      // still update liquidity display if desired
      paintLiquidity(Number(d.reserve1) * currencyUsdPrice * 2);
    },
    onError: err => console.error('Reserves WS error', err),
    onOpen: () => console.log('Reserves WS open'),
  });


  currentCandlesWs = api.subscribePairCandles(pairId, chartDenom, "5m", {
  onOpen: () => console.log('Candles WS connected for', pairId),
  onError: err => console.error('Candles WS error', err),
  onData: incomingCandle => {
    if (!incomingCandle || !incomingCandle.t) return;

    // 1) pull your last bar (time in seconds)
    const last = chart.getLastBar();
    if (last) {
      const lastTs = last.time * 1000;          // to ms
      const newTs  = incomingCandle.t;          // already in ms

      // 2) how many *full* intervals elapsed?
      const missed = Math.floor((newTs - lastTs) / ivMs) - 1;
      for (let i = 1; i <= missed; i++) {
        const emptyTs = lastTs + ivMs * i;
        chart.upsertLastCandle({
          t:      emptyTs,
          open:   last.close,
          high:   last.close,
          low:    last.close,
          close:  last.close,
          volume: 0
        });
      }
    }

    // 3) now add the real candle
    chart.upsertLastCandle(incomingCandle);
  }
});

  /* 6) trades ------------------------------------------------------------*/


  // ── NEW: tear down previous subscription if any
  if (currentTradesWs) {
    currentTradesWs.close();
    currentTradesWs = null;
  }



  // ── NEW: subscribe to live trades
  let firstTrade = true;
  let lastTradeTs = 0; // watermark for filtering out old trades
  currentTradesWs = api.subscribePairTrades(pairId, denomTrades, {

    onData: payload => {
      const incoming = (payload.trades || [])
        // only take truly new ones
        .filter(t => new Date(t.created).getTime() > lastTradeTs)
        // sort newest-first for prependTrades
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      if (!incoming.length) return;

      if (firstTrade) {
        els.tradesList.innerHTML = '';      // only once, at the very start
        firstTrade = false;
      }

      // render the truly new trades
      prependTrades(incoming, meta0, meta1);

      // bump your watermark
      lastTradeTs = Math.max(
        lastTradeTs,
        ...incoming.map(t => new Date(t.created).getTime())
      );

    
    },
    onError: err => console.error('Trades WS error', err),
    onOpen: () => console.log('Connected to live trades for', pairId),
  });
}
window.selectPair = selectPair;  // expose to global scope

// every minute, advance the “current” empty candle if needed
setInterval(() => {
  const last = chart.getLastBar();
  if (!last) return;
  const slot = Math.floor(Date.now() / ivMs) * ivMs;
  if (slot > last.time * 1000) {
    chart.upsertLastCandle({
      t:      slot,
      open:   last.close,
      high:   last.close,
      low:    last.close,
      close:  last.close,
      volume: 0
    });
  }
}, 60 * 1000);


function updateVisibleRows() {
  if (!hasRealData) return;

  const rawTop = els.pairsScroller.scrollTop;
  const start = Math.max(0, Math.floor(rawTop / rowH));
  const end = Math.min(start + Math.ceil(els.pairsScroller.clientHeight / rowH) + 4, liveRows.length);

  els.topPad.style.height = start * rowH + 'px';
  els.bottomPad.style.height = (liveRows.length - end) * rowH + 'px';
  els.rowHost.innerHTML = '';

  for (let i = start; i < end; i++) {
    const { id, btn } = liveRows[i];
    const pair = allPairs.find(p => p.pair === id);
    els.rowHost.appendChild(btn);
    hydrateMetadataIfNeeded(pair); // 👈 Lazy hydrate here
  }
}
async function onSearch(e) {
  searchTerm = e.target.value.trim().toLowerCase();

  // 1) Raw + cache‐based prefilter
  const rawMatches = allPairs.filter(pair => {
    return (
      pair.token0.includes(searchTerm) ||
      pair.token1.includes(searchTerm) ||
      (TOKEN_CACHE[pair.token0]?.symbol || '')
        .toLowerCase().includes(searchTerm) ||
      (TOKEN_CACHE[pair.token1]?.symbol || '')
        .toLowerCase().includes(searchTerm)
    );
  });

  // 2) Refresh UI immediately with rawMatches
  liveRows.length = 0;
  els.rowHost.innerHTML = '';
  rawMatches.forEach(upsertRow);

  // 3) Hydrate only *uncached* tokens from rawMatches
  const tokensToHydrate = Array.from(new Set(
    rawMatches.flatMap(p => [p.token0, p.token1])
  )).filter(t => !TOKEN_CACHE[t]);

  // 4) Fire & forget hydration, letting per-row refresh handle the redraw
  tokensToHydrate.forEach(async (token) => {
    try {
      await api.fetchTokenMeta(token);
      // Once metadata is in cache, each visible row will call
      // hydrateMetadataIfNeeded → refreshSidebarRow → update UI.
    } catch (err) {
      console.warn(`Failed to load metadata for ${token}`, err);
    }
  });
}
function matchesSearch(pair) {
  if (!searchTerm) return true;           // empty box → show all

  const meta0 = TOKEN_CACHE[pair.token0] || {};
  const meta1 = TOKEN_CACHE[pair.token1] || {};

  const haystack = [
    meta0.symbol, meta1.symbol,
    meta0.name, meta1.name,
    pair.token0, pair.token1           // ← raw contracts as fallback
  ]
    .filter(Boolean)                    // drop undefined / null / ''
    .join(' ')
    .toLowerCase();

  return haystack.includes(searchTerm);
}

function prependTrades(list, meta0, meta1) {
  list.slice().reverse().forEach(t => {           // oldest-first
    const row = buildTradeRow(t, meta0, meta1);   // reuse your exact logic
    els.tradesList.insertBefore(row, els.tradesList.firstChild);
  });
  // keep table lean
  while (els.tradesList.children.length > 40) els.tradesList.lastChild.remove();
}

function buildTradeRow(t, meta0, meta1) {
  let side = ((t.side || '').toLowerCase() === 'buy') ? 'Buy' : 'Sell';
  let amountSymbol = t.amountSymbol || meta0.symbol;
  let price;
  let amount = t.amount || 0;
  if (meta1.symbol === 'xUSDC') {
    price = formatPrice(1 / t.price);  // xUSDC is a stablecoin, invert price
  } else {
    price = formatPrice(t.price);
  }
  if (meta1.symbol === 'xUSDC' && meta0.symbol === 'XIAN') {
    side = (side === 'Buy') ? 'Sell' : 'Buy';  // reverse for USDC/currency
  }
  else {
    amountSymbol = meta0.symbol;  // always use token0 symbol
    amount = t.amount0 || t.amount1 || 0;  // prefer token0 amount
  }
  const sym0 = meta0.symbol;
  const row = document.createElement('tr');
 row.className = `
    odd:bg-white/5 hover:bg-white/10
    transition cursor-pointer select-none`;      // new classes

  row.innerHTML = `
    <td class="px-2 py-2 text-left ${side === 'Buy' ? 'text-emerald-400' : 'text-rose-400'} whitespace-nowrap">
      ${side}
    </td>
    <td class="px-2 py-2 text-right whitespace-nowrap">
      ${amount.toLocaleString(undefined,{minFractionDigits:2,maxFractionDigits:4})} ${amountSymbol}
    </td>
    <td class="px-2 py-2 text-right whitespace-nowrap">
      ${price.toLocaleString(undefined,{minFractionDigits:2,maxFractionDigits:8})} ${meta1.symbol}
    </td>
    <td class="px-2 py-2 text-right text-gray-400 whitespace-nowrap">
      ${timeAgo(t.created)}
    </td>`;

  /* ───── click → explorer ───── */
  const url = `https://explorer.xian.org/tx/${t.txHash}`;
  row.addEventListener('click', () =>
    window.open(url, '_blank', 'noopener'));

  return row;
}

document.querySelectorAll('#tfToolbar .tf-btn').forEach(btn=>{
  btn.onclick = ()=> {
    document.querySelector('.tf-btn.active')?.classList.remove('active');
    btn.classList.add('active');
    chart.changeTimeframe(btn.dataset.tf);   // new helper you just exported
  };
});