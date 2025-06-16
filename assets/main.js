/* Glue code – ties everything together ----------------------------------*/
import { els, showSidebarSkeleton, showMainSkeleton } from './ui.js';
import * as api from './api.js';
import * as chart from './chart.js';
import { chunk, timeAgo, getPairFromHash, setPairHash, formatPrice } from './utils.js';
import { TOKEN_CACHE } from './api.js';
import { binarySearch } from './utils.js';
let currencyUsdPrice = 0;    // USD per Xian
const liveRows = [];
const rowH = 56;              // px – real height of 1 sidebar row

/* ─── search state ────────────────────────────────────────── */
let searchTerm = '';          // current lowercase query
let allPairs = [];          // master list (set in init)
let sidebarStats = {};          // 24 h vol/Δ cache (set later)

/* --------------------------- Start-up -----------------------------------*/
document.addEventListener('DOMContentLoaded', init);
const sb = document.getElementById('sidebar');
function toggleSidebar() {
  sb.classList.toggle('-translate-x-full');
  sb.classList.toggle('pointer-events-none');
}

document.getElementById('hamburger').onclick   = toggleSidebar;
document.getElementById('closeSidebar').onclick = toggleSidebar;
async function init() {
  showSidebarSkeleton();
  showMainSkeleton();
  els.pairsScroller.addEventListener('scroll', updateVisibleRows);
  const ro = new ResizeObserver(updateVisibleRows);
  ro.observe(els.pairsScroller);

  document.getElementById('pairSearch')
    .addEventListener('input', onSearch);

  currencyUsdPrice = (await api.getCurrencyPrice()).priceNow;
  const rawPairs = (await api.getPairs()).pairs;
  allPairs = normalisePairs(rawPairs);
  await preloadTokenMetadata(allPairs);
  sidebarStats = await batchSidebarStats(allPairs);

  renderSidebar(allPairs, sidebarStats);           // first paint
  // deep-link support
  const maybeId = getPairFromHash();
  if (maybeId && allPairs.some(p => p.pair === maybeId)) {
    selectPair(maybeId);
  } else if (allPairs.length) {
    selectPair(allPairs[0].pair);
  }
}

/* -------------------------- Sidebar ------------------------------------*/
function normalisePairs(pairs) {
  return pairs.map(p => (p.token0 === 'con_usdc' && p.token1 === 'currency')
    ? { ...p, token0: 'currency', token1: 'con_usdc', pair: '1' }
    : p);
}

async function preloadTokenMetadata(pairs) {
  const contracts = [...new Set(pairs.flatMap(p => [p.token0, p.token1]))];
  await Promise.all(contracts.map(api.fetchTokenMeta));
}

async function batchSidebarStats(pairs) {
  const paths = pairs.flatMap(p => [
    `/pairs/${p.pair}/pricechange24h?token=1`,
    `/pairs/${p.pair}/volume24h?token=1`,
  ]);
  paths.unshift('/pairs/1/pricechange24h?token=0', '/pairs/1/volume24h?token=0');

  const stats = {};
  for (const grp of chunk(paths, 16)) {
    const res = await Promise.all(
      grp.map(path => api.throttledFetchJSON(api.API_BASE + path))
    );
    res.forEach((r, i) => {
      stats[grp[i]] = r;

      /* — stream update for the pair touched by this API path — */
      const m = grp[i].match(/\/pairs\/(\d+)\//);   // capture pair id
      if (m) {
        const id = m[1];
        const pairObj = pairs.find(p => p.pair === id);
        if (pairObj) upsertRow(pairObj, stats);
      }
    });
  }
  return stats;
}
function renderSidebar(pairs, stats) {
  // first call: clear skeleton; afterwards we keep DOM nodes alive
  if (!liveRows.length) els.pairsList.innerHTML = '';

  pairs.forEach(p => upsertRow(p, stats));
  updateVisibleRows();
}

function upsertRow(pair, stats) {
  if (!matchesSearch(pair)) return;   // skip if filtered out
  const volUSD = usdVol(stats, pair);

  /* 1) de-duplicate ---------------------------------------------------- */
  const oldIdx = liveRows.findIndex(r => r.id === pair.pair);
  if (oldIdx !== -1) {
    liveRows.splice(oldIdx, 1);          // remove old record only
  }

  /* 2) find sorted position ------------------------------------------- */
  const pos = binarySearch(liveRows, volUSD, r => r.vol);

  /* 3) build / store button ------------------------------------------- */
  const btn = makePairButton(pair, volUSD, stats);
  liveRows.splice(pos, 0, { id: pair.pair, vol: volUSD, btn });

  /* 4) repaint the visible window ------------------------------------- */
  updateVisibleRows();
}


function makePairButton(p, volUSD, stats) {
  const pct = (p.token0 === 'currency' && p.token1 === 'con_usdc')
    ? stats['/pairs/1/pricechange24h?token=0'].changePct
    : stats[`/pairs/${p.pair}/pricechange24h?token=1`]?.changePct ?? 0;

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
             onerror="this.onerror=null;this.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';" />
        <span>${t0} / ${t1}</span>
      </span>
      <span class="text-xs ${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        ${pct.toFixed(2)}%
      </span>
    </div>
    <div class="text-xs text-gray-400 mt-0.5">
      $${volUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} vol
    </div>`;
  btn.onclick = () => selectPair(p.pair);
  return btn;
}

function usdVol(stats, p) {
  const id = p.token0 === 'currency' && p.token1 === 'con_usdc'
    ? '/pairs/1/volume24h?token=1'
    : `/pairs/${p.pair}/volume24h?token=1`;
  return (stats[id]?.volume24h ?? 0) * currencyUsdPrice;
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
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // 1×1 GIF fallback
  els.pairLogo.onerror = () => {                            // graceful 404
    els.pairLogo.src =
      'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  };

  els.pairName.textContent = `${meta0.symbol} / ${meta1.symbol}`;

  /* 2) concurrent data ---------------------------------------------------*/
  const [priceD, volD, tradesD, resD] = await Promise.all([
    api.get24hPriceChange(pairId, denomPrice),
    api.get24hVolume(pairId, denomVol),
    api.getPairTrades(pairId, { token: denomTrades }),
    api.getPairReserves(pairId),
  ]);

  /* 3) stats bar ---------------------------------------------------------*/
  const priceNow = priceD.priceNow ?? priceD.price ?? 0;
  els.price.textContent = `${formatPrice(priceNow)} ${meta1.symbol}`;

  const pct = priceD.changePct ?? priceD.percentChange ?? 0;
  els.delta.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  els.delta.className = `${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-medium`;

  els.volume.textContent = `$${(volD.volume24h * currencyUsdPrice).toLocaleString()}`;

  /* 4) liquidity ---------------------------------------------------------*/
  const usdLiq = Number(resD.reserve1 || 0) * currencyUsdPrice * 2;
  els.liquidity.textContent = `$${usdLiq.toLocaleString(undefined, { minFractionDigits: 2, maxFractionDigits: 2 })}`;

  /* mobile mirrors */
els.priceM.textContent     = els.price.textContent;
els.deltaM.textContent     = els.delta.textContent;
els.deltaM.classList.add(...els.delta.classList); // copy classes
els.liquidityM.textContent = els.liquidity.textContent;
els.volumeM.textContent    = els.volume.textContent;

  /* 5) chart -------------------------------------------------------------*/
  chart.initEmptyChart();
  await chart.loadInitialCandles(pairId, chartDenom);

  updateTradeBox({
    id: pairId,
    sym0: meta0.symbol,
    sym1: meta1.symbol,
    price: priceNow.toLocaleString(undefined, { maximumFractionDigits: 6 }) + ' ' + meta1.symbol,
    balance0: '—',            // fetch wallet balances if you like
    balance1: '—',
    contract0: token0,
    contract1: token1,
    currentPrice: priceNow,
    reserve0: resD.reserve0 || 0,
    reserve1: resD.reserve1 || 0,
  });
  refreshBalanceLine();

  /* 6) trades ------------------------------------------------------------*/
  els.tradesList.innerHTML = '';
  (tradesD.trades || []).forEach(t => {
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
    else{
      amountSymbol = meta0.symbol;  // always use token0 symbol
      amount = t.amount0 || t.amount1 || 0;  // prefer token0 amount
    }
    const sym0 = meta0.symbol;
    const row = document.createElement('tr');
    row.className = 'odd:bg-white/5 hover:bg-white/10 transition';
    row.innerHTML = `
      <td class="px-2 py-2 text-left ${side === 'Buy' ? 'text-emerald-400' : 'text-rose-400'} whitespace-nowrap">${side}</td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        ${amount.toLocaleString(undefined, { minFractionDigits: 2, maxFractionDigits: 4 })} ${amountSymbol}
      </td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        ${price.toLocaleString(undefined, { minFractionDigits: 2, maxFractionDigits: 8 })} ${meta1.symbol}
      </td>
      <td class="px-2 py-2 text-right text-gray-400 whitespace-nowrap">${timeAgo(t.created)}</td>`;
    els.tradesList.appendChild(row);
  });
}
function updateVisibleRows() {
  const start = Math.floor(els.pairsScroller.scrollTop / rowH);
  const end = Math.min(start + Math.ceil(els.pairsScroller.clientHeight / rowH) + 4,
    liveRows.length);

  // Resize padders
  els.topPad.style.height = start * rowH + 'px';
  els.bottomPad.style.height = (liveRows.length - end) * rowH + 'px';

  // Mount only the rows we need
  els.rowHost.innerHTML = '';                 // cheap clear
  for (let i = start; i < end; i++) {
    els.rowHost.appendChild(liveRows[i].btn);
  }
}
function onSearch(e) {
  searchTerm = e.target.value.trim().toLowerCase();
  // wipe current view
  liveRows.length = 0;
  els.rowHost.innerHTML = '';
  updateVisibleRows();                 // reset padders
  // re-insert only matches
  const visiblePairs = allPairs.filter(matchesSearch);
  visiblePairs.forEach(p => upsertRow(p, sidebarStats));
}
function matchesSearch(pair) {
  if (!searchTerm) return true;        // empty → show all
  const meta0 = TOKEN_CACHE[pair.token0];
  const meta1 = TOKEN_CACHE[pair.token1];

  const haystack =
    (meta0.symbol + ' ' + meta1.symbol + ' ' +
      meta0.name + ' ' + meta1.name + ' ' +
      pair.token0 + ' ' + pair.token1).toLowerCase();

  return haystack.includes(searchTerm);
}

