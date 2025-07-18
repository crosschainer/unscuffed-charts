/* Glue code – ties everything together ----------------------------------*/
import { els, showSidebarSkeleton, showMainSkeleton } from './ui.js';
import * as api from './api.js';
import * as chart from './chart.js';
import { getPairFromHash, isFarmsHash } from './utils.js';
import { 
  currencyUsdPrice, 
  setCurrencyUsdPrice, 
  liveRows, 
  allPairs, 
  setAllPairs, 
  setHasRealData,
  isScrolling,
  setIsScrolling,
  scrollTimeout,
  setScrollTimeout,
  CURRENCY_UPDATE_INTERVAL,
  ivMs
} from './state.js';
import { 
  setCurrentPairsWs, 
  getCurrentPairsWs 
} from './websockets.js';
import { 
  normalisePairs, 
  renderSidebar, 
  upsertRow, 
  refreshSidebarRow, 
  updateVisibleRows, 
  onSearch, 
  matchesSearch, 
  toUsdVol 
} from './sidebar.js';
import { selectPair } from './pair-page.js';
import { blinkLive, tickUpdated } from './ui-updates.js';

/* --------------------------- Start-up -----------------------------------*/
document.addEventListener('DOMContentLoaded', init);
const sb = document.getElementById('sidebar');

function toggleSidebar() {
  sb.classList.toggle('-translate-x-full');
  sb.classList.toggle('pointer-events-none');
}

document.getElementById('hamburger').onclick = toggleSidebar;
document.getElementById('closeSidebar').onclick = toggleSidebar;

async function updateCurrencyPrice() {
  try {
    const { priceNow } = await api.getCurrencyPrice();
    if (priceNow != null) setCurrencyUsdPrice(priceNow);
  } catch (err) {
    console.warn('Failed to refresh XIAN→USD rate', err);
  }
}

function handleScroll() {
  setIsScrolling(true);
  
  // Clear existing timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  // Only update after scroll stops to prevent jumping
  setScrollTimeout(setTimeout(() => {
    setIsScrolling(false);
    updateVisibleRows();
  }, 50)); // Increased delay to prevent conflicts
}

function handleResize() {
  if (!isScrolling) {
    updateVisibleRows();
  }
}

// Function to show the farms placeholder
function showFarmsPlaceholder() {
  // Hide the trade container
  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('tradeView').style.display = 'none';
  document.getElementById('farmsView').style.display = 'flex';
  if(!document.getElementById('mobilePairHeader').classList.contains('hidden')) {
    document.getElementById('mobilePairHeader').classList.add('hidden');
  }
  
  // Update navigation highlighting
  document.querySelector('a[href="/#pair=1"]').classList.remove('text-brand-cyan', 'border-brand-cyan');
  document.querySelector('a[href="/#pair=1"]').classList.add('text-gray-300', 'border-transparent');
  document.querySelector('a[href="/#farms"]').classList.remove('text-gray-300', 'border-transparent');
  document.querySelector('a[href="/#farms"]').classList.add('text-brand-cyan', 'border-brand-cyan');
}

// Function to show the pairs view
function showPairsView() {
  // Show the trade container
  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('tradeView').style.display = 'flex';
  document.getElementById('farmsView').style.display = 'none';
  if(document.getElementById('mobilePairHeader').classList.contains('hidden')) {
    document.getElementById('mobilePairHeader').classList.remove('hidden');
  }
  
  // Update navigation highlighting
  document.querySelector('a[href="/#pair=1"]').classList.add('text-brand-cyan', 'border-brand-cyan');
  document.querySelector('a[href="/#pair=1"]').classList.remove('text-gray-300', 'border-transparent');
  document.querySelector('a[href="/#farms"]').classList.add('text-gray-300', 'border-transparent');
  document.querySelector('a[href="/#farms"]').classList.remove('text-brand-cyan', 'border-brand-cyan');
}

// Function to handle hash changes
function handleHashChange() {
  if (isFarmsHash()) {
    showFarmsPlaceholder();
  } else {
    showPairsView();
    const maybeId = getPairFromHash();
    if (maybeId && allPairs.some(p => p.pair === maybeId)) {
      selectPair(maybeId);
    } else if (allPairs.length) {
      selectPair(allPairs[0].pair);
    }
  }
}

async function init() {
  showSidebarSkeleton();
  showMainSkeleton();
  
  // Setup scrolling with debouncing
  els.pairsScroller.addEventListener('scroll', handleScroll);
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(els.pairsScroller);

  document.getElementById('pairSearch')
    .addEventListener('input', onSearch);

  try {
    setCurrencyUsdPrice((await api.getCurrencyPrice()).priceNow);
  } catch (err) {
    console.warn('Failed to get initial XIAN→USD rate', err);
    setCurrencyUsdPrice(0);
  }

  // Start polling for currency price updates
  setInterval(updateCurrencyPrice, CURRENCY_UPDATE_INTERVAL);

  const rawPairs = (await api.getPairs({ limit: 1031 })).pairs; // already sorted DESC
  setAllPairs(normalisePairs(rawPairs));

  setHasRealData(true);
  renderSidebar(allPairs);                         // first paint

  // ── Subscribe to live all-pairs feed with reconnection support
  const pairsCallbacks = {
    onData: payload => {
      const live = normalisePairs(payload.pairs || []);
      setAllPairs(live);

      // Track if any changes were made
      let hasChanges = false;
      
      // For each incoming pair update…
      live.forEach(p => {
        // 1) Find the old in-memory model
        const old = liveRows.find(r => r.id === p.pair);
        if (old) {
          // 2) Only update vol/price if they've changed
          const newVol = toUsdVol(p);
          const newPct = p.pricePct24h ?? 0;
          if (old.vol !== newVol || old.pct !== newPct) {
            // 3) Mutate your liveRows state
            old.vol = newVol;
            old.pct = newPct;
            // 4) Re-draw that one button
            refreshSidebarRow(p);
            hasChanges = true;
          }
        } else if (matchesSearch(p)) {
          // It's new: insert it
          upsertRow(p);
          hasChanges = true;
        }
      });

      // Only update visible rows if there were changes and not during active scrolling
      if (hasChanges && !isScrolling) {
        updateVisibleRows();
      }
    },
    onError: err => console.error('Pairs WS error', err),
    onOpen: () => console.log('Pairs WS connected'),
  };
  
  setCurrentPairsWs(api.subscribePairs(pairsCallbacks), pairsCallbacks);

  // Add hash change event listener
  window.addEventListener('hashchange', handleHashChange);
  
  // Initial route handling
  handleHashChange();

  tickUpdated(); // initial time stamp
  setInterval(tickUpdated, 1_000);     // every second
}

// Export selectPair for global access
window.selectPair = selectPair;

// Export token validation function for global access
window.fetchTokenMetadata = async function(tokenContract) {
  try {
    return await api.fetchTokenMeta(tokenContract);
  } catch (error) {
    console.warn('Token metadata fetch failed:', error);
    return null;
  }
};

// every minute, advance the "current" empty candle if needed
setInterval(() => {
  const last = chart.getLastBar();
  if (!last) return;
  const slot = Math.floor(Date.now() / ivMs) * ivMs;
  if (slot > last.time * 1000) {
    chart.upsertLastCandle({
      t: slot,
      open: last.close,
      high: last.close,
      low: last.close,
      close: last.close,
      volume: 0
    });
  }
}, 60 * 1000);

// Timeframe button handlers
document.querySelectorAll('#tfToolbar .tf-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelector('.tf-btn.active')?.classList.remove('active');
    btn.classList.add('active');
    chart.changeTimeframe(btn.dataset.tf);   // new helper you just exported
  };
});