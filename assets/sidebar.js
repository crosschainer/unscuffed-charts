/* Sidebar Management ------------------------------------------------------*/
import { els } from './ui.js';
import { TOKEN_CACHE } from './api.js';
import * as api from './api.js';
import { 
  liveRows, 
  ROW_HEIGHT, 
  searchTerm, 
  allPairs, 
  hasRealData, 
  isScrolling,
  hydratingContracts,
  hydratedPairs,
  currencyUsdPrice,
  setSearchTerm
} from './state.js';

export function normalisePairs(pairs) {
  return pairs.map(p => (p.token0 === 'con_usdc' && p.token1 === 'currency')
    ? { ...p, token0: 'currency', token1: 'con_usdc', pair: '1' }
    : p);
}

export async function hydrateMetadataIfNeeded(pair) {
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

export function refreshSidebarRow(pair) {
  const idx = liveRows.findIndex(r => r.id === pair.pair);
  if (idx === -1) return;

  const newBtn = makePairButton(pair, toUsdVol(pair));
  liveRows[idx].btn = newBtn;

  // Replace the old button in DOM if it exists
  const oldBtn = els.rowHost.querySelector(`button[data-pair="${pair.pair}"]`);
  if (oldBtn) oldBtn.replaceWith(newBtn);
}

export function renderSidebar(pairs) {
  pairs.forEach(upsertRow);
  updateVisibleRows(); // only safe now
}

export function upsertRow(pair) {
  if (!pair || !matchesSearch(pair)) return;
  
  try {
    const volUSD = toUsdVol(pair);
    
    // Remove existing entry if present
    const oldIdx = liveRows.findIndex(r => r.id === pair.pair);
    if (oldIdx !== -1) {
      liveRows.splice(oldIdx, 1);
    }
    
    // Create new button and add to rows
    const btn = makePairButton(pair, volUSD);
    liveRows.push({ 
      id: pair.pair, 
      vol: volUSD, 
      pct: pair.pricePct24h ?? 0,
      btn 
    });

    // Update visible rows if not currently scrolling
    if (!isScrolling) {
      updateVisibleRows();
    }
  } catch (err) {
    console.warn('Failed to upsert row for pair:', pair.pair, err);
  }
}

export function makePairButton(pair, volUSD) {
  const pct = pair.pricePct24h ?? 0;
  const meta0 = TOKEN_CACHE[pair.token0] ?? { symbol: pair.token0, logo: '' };
  const meta1 = TOKEN_CACHE[pair.token1] ?? { symbol: pair.token1, logo: '' };
  
  const btn = document.createElement('button');
  btn.className = 'flex flex-col items-start w-full px-4 py-2 text-left hover:bg-white/5 active:bg-white/10 transition';
  btn.setAttribute('data-pair', pair.pair);
  
  // Use safer innerHTML construction
  const logoSrc = meta0.logo || './assets/ph.png';
  const pctClass = pct >= 0 ? 'text-emerald-400' : 'text-rose-400';
  const formattedVol = volUSD.toLocaleString(undefined, { maximumFractionDigits: 0 });
  
  btn.innerHTML = `
    <div class="flex items-center justify-between w-full">
      <span class="flex items-center gap-2">
        <img src="${logoSrc}" width="20" height="20" 
             onerror="this.onerror=null;this.src='./assets/ph.png';" 
             alt="${meta0.symbol} logo" />
        <span>${meta0.symbol} / ${meta1.symbol}</span>
      </span>
      <span class="text-xs ${pctClass}">
        ${pct.toFixed(2)}%
      </span>
    </div>
    <div class="text-xs text-gray-400 mt-1.5">
      $${formattedVol} vol
    </div>`;

  btn.onclick = () => {
    // Use global selectPair function
    if (window.selectPair) {
      window.selectPair(pair.pair);
      if (window.matchMedia('(max-width: 767px)').matches) {
        toggleSidebar();
      }
    }
  };
  
  return btn;
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('-translate-x-full');
  sb.classList.toggle('pointer-events-none');
}

export function toUsdVol(pair) {
  /* token-1 side is always the 'dollar' side in the new payload */
  return (pair.volume24h ?? 0) * currencyUsdPrice;
}

export function updateVisibleRows() {
  if (!hasRealData || !liveRows.length) return;

  const scroller = els.pairsScroller;
  const scrollTop = scroller.scrollTop;
  const clientHeight = scroller.clientHeight;
  
  // Calculate visible range with buffer
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
  const visibleCount = Math.ceil(clientHeight / ROW_HEIGHT);
  const buffer = 3; // Increased buffer for smoother scrolling
  const end = Math.min(start + visibleCount + buffer, liveRows.length);

  // Store current scroll position to prevent jumping
  const currentScrollTop = scroller.scrollTop;

  // Update padding to maintain scroll position
  els.topPad.style.height = `${start * ROW_HEIGHT}px`;
  els.bottomPad.style.height = `${(liveRows.length - end) * ROW_HEIGHT}px`;

  // Clear and rebuild visible rows
  const fragment = document.createDocumentFragment();
  
  for (let i = start; i < end; i++) {
    if (i >= liveRows.length) break;
    
    const { id, btn } = liveRows[i];
    const pair = allPairs.find(p => p.pair === id);
    
    if (btn && pair) {
      fragment.appendChild(btn);
      hydrateMetadataIfNeeded(pair);
    }
  }

  // Replace content in one operation to reduce reflows
  els.rowHost.innerHTML = '';
  els.rowHost.appendChild(fragment);
  
  // Restore scroll position if it changed during DOM manipulation
  if (scroller.scrollTop !== currentScrollTop) {
    scroller.scrollTop = currentScrollTop;
  }
}

export async function onSearch(e) {
  setSearchTerm(e.target.value.trim().toLowerCase());

  try {
    // Filter pairs based on search term
    const filteredPairs = allPairs.filter(matchesSearch);

    // Clear and rebuild the list
    liveRows.length = 0;
    els.rowHost.innerHTML = '';
    
    // Add filtered pairs to the list
    filteredPairs.forEach(upsertRow);

    // Hydrate uncached tokens for better search results
    const tokensToHydrate = Array.from(new Set(
      filteredPairs.flatMap(pair => [pair.token0, pair.token1])
    )).filter(token => !TOKEN_CACHE[token]);

    // Load metadata for uncached tokens
    tokensToHydrate.forEach(async (token) => {
      try {
        await api.fetchTokenMeta(token);
      } catch (err) {
        console.warn(`Failed to load metadata for ${token}`, err);
      }
    });
  } catch (err) {
    console.error('Search failed:', err);
  }
}

export function matchesSearch(pair) {
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