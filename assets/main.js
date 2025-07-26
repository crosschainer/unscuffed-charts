/* Glue code – ties everything together ----------------------------------*/
import { els, showSidebarSkeleton, showMainSkeleton } from './ui.js';
import * as api from './api.js';
import * as chart from './chart.js';
import { getPairFromHash, isFarmsHash, isStakingHash } from './utils.js';
import './staking.js'; // Initialize staking module
import './farms.js';   // Initialize farms module
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
  setScrollTimeout
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
import { INTERVALS, DEFAULTS } from './constants.js';
import { viewManager } from './view-manager.js';
import { handleError, createNetworkError, createWebSocketError } from './error-handler.js';
import { debounce, addEventListener } from './dom-utils.js';

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
    handleError(createNetworkError('Failed to refresh XIAN→USD rate', err), 'updateCurrencyPrice');
  }
}

const handleScroll = debounce(() => {
  setIsScrolling(true);
  
  // Clear existing timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  // Only update after scroll stops to prevent jumping
  setScrollTimeout(setTimeout(() => {
    setIsScrolling(false);
    updateVisibleRows();
  }, INTERVALS.SCROLL_DEBOUNCE));
}, INTERVALS.SCROLL_DEBOUNCE);

function handleResize() {
  if (!isScrolling) {
    updateVisibleRows();
  }
}

// View management functions - now using centralized view manager
const showFarmsPlaceholder = () => viewManager.showFarms();
const showStakingPlaceholder = () => viewManager.showStaking();
const showPairsView = () => viewManager.showTrade();

// Function to handle hash changes
function handleHashChange() {
  if (isFarmsHash()) {
    showFarmsPlaceholder();
  } else if (isStakingHash()) {
    showStakingPlaceholder();
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
    handleError(createNetworkError('Failed to get initial XIAN→USD rate', err), 'init');
    setCurrencyUsdPrice(0);
  }

  // Start polling for currency price updates
  setInterval(updateCurrencyPrice, INTERVALS.CURRENCY_UPDATE);

  const rawPairs = (await api.getPairs({ limit: DEFAULTS.PAIR_LIMIT })).pairs; // already sorted DESC
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
    onError: err => handleError(createWebSocketError('Pairs WebSocket error', err), 'pairsWebSocket'),
    onOpen: () => console.log('Pairs WS connected'),
  };
  
  setCurrentPairsWs(api.subscribePairs(pairsCallbacks), pairsCallbacks);

  // Add hash change event listener
  window.addEventListener('hashchange', handleHashChange);
  
  // Initial route handling
  handleHashChange();

  tickUpdated(); // initial time stamp
  setInterval(tickUpdated, INTERVALS.UI_UPDATE);     // every second
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
  const slot = Math.floor(Date.now() / INTERVALS.CANDLE_INTERVAL) * INTERVALS.CANDLE_INTERVAL;
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
}, INTERVALS.EMPTY_CANDLE_ADVANCE);

// Timeframe button handlers
document.querySelectorAll('#tfToolbar .tf-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelector('.tf-btn.active')?.classList.remove('active');
    btn.classList.add('active');
    chart.changeTimeframe(btn.dataset.tf);   // new helper you just exported
  };
});