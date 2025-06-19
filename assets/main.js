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
let candleTimer = null;         // live candle updates
let tradeTimer = null;          // live trade updates
let statsTimer = null;          // live stats updates
let hasRealData = false; // top-level flag


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
  const rawPairs = (await api.getPairs({ limit:1031 })).pairs; // already sorted DESC
  allPairs = normalisePairs(rawPairs);
  await preloadTokenMetadata(allPairs);

  renderSidebar(allPairs);                         // first paint
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
els.deltaM.classList.remove('text-emerald-400', 'text-rose-400');
els.deltaM.classList.add(els.delta.className.split(' ')[0]); // copy class
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
window.selectPair = selectPair;  // expose to global scope

function updateVisibleRows() {
  if (!hasRealData) return; // skip during skeleton mode
  const rawTop = els.pairsScroller.scrollTop;
  const start  = Math.max(0, Math.floor(rawTop / rowH));
  const end = Math.min(Math.max(start, start + Math.ceil(els.pairsScroller.clientHeight / rowH) + 4), liveRows.length);

  els.topPad.style.height = start * rowH + 'px';
  els.bottomPad.style.height = (liveRows.length - end) * rowH + 'px';

  els.rowHost.innerHTML = ''; // ← clear for virtual scroll
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
  visiblePairs.forEach(upsertRow);
}
function matchesSearch(pair) {
  if (!searchTerm) return true;           // empty box → show all

    const meta0 = TOKEN_CACHE[pair.token0] || {};
  const meta1 = TOKEN_CACHE[pair.token1] || {};

  const haystack = [
   meta0.symbol, meta1.symbol,
    meta0.name,   meta1.name,
    pair.token0,  pair.token1           // ← raw contracts as fallback
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
    else{
      amountSymbol = meta0.symbol;  // always use token0 symbol
      amount = t.amount0 || t.amount1 || 0;  // prefer token0 amount
    }

  const row = document.createElement('tr');
  row.className = 'odd:bg-white/5 hover:bg-white/10 transition';
  row.innerHTML = `
    <td class="px-2 py-2 text-left ${side==='Buy'?'text-emerald-400':'text-rose-400'} whitespace-nowrap">${side}</td>
    <td class="px-2 py-2 text-right whitespace-nowrap">
      ${amount.toLocaleString(undefined,{minFractionDigits:2,maxFractionDigits:4})} ${amountSymbol}
    </td>
    <td class="px-2 py-2 text-right whitespace-nowrap">
      ${price.toLocaleString(undefined,{minFractionDigits:2,maxFractionDigits:8})} ${meta1.symbol}
    </td>
    <td class="px-2 py-2 text-right text-gray-400 whitespace-nowrap">${timeAgo(t.created)}</td>`;
  return row;
}
