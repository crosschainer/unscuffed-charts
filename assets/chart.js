/* LightweightCharts wrapper – now with client‑side time‑frame resampling
   -----------------------------------------------------------------------*/
import { els } from './ui.js';
import { getPairCandles } from './api.js';

/* ────────────────────────── Constants & helpers ────────────────────── */
// 5‑minute candles are the canonical feed.  We derive larger buckets here.
const TF_MS = {
  '5m':  5  * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h':  60 * 60_000,
  '4h':   4 * 60 * 60_000,
  '1d':  24 * 60 * 60_000,
};

const PRECISION = 6;                     // price precision shown on axis

// Convert API candle to our bar shape
function toBar(c) {
  let seconds;                           // final timestamp in seconds

  if (typeof c.t === 'string') {         // REST history payload
    const iso = c.t.endsWith('Z') ? c.t : c.t + 'Z';
    seconds = Math.floor(Date.parse(iso) / 1000);

  } else if (typeof c.t === 'number') {  // WS or gap-filler gives epoch
    // If it looks like milliseconds, down-convert
    seconds = c.t > 9_999_999_999 ? Math.floor(c.t / 1000) : c.t;

  } else if (typeof c.time === 'number') { // helper already passed secs
    seconds = c.time;

  } else {
    throw new TypeError('Candle missing valid time property');
  }

  return {
    time:   seconds,
    open:   c.open,
    high:   c.high,
    low:    c.low,
    close:  c.close,
    volume: c.volume,
  };
}

// Aggregate a 5‑minute series to arbitrary bucket size (ms)
function aggregate(src, bucketMs) {
  if (!bucketMs || bucketMs === TF_MS['5m']) return src.slice();
  const result = [];
  let bucket = null;

  src.forEach(b => {
    const bucketStartMs = Math.floor(b.time * 1000 / bucketMs) * bucketMs;
    if (!bucket || bucket.time !== bucketStartMs / 1000) {
      if (bucket) result.push(bucket);         // flush previous
      bucket = {
        time:   bucketStartMs / 1000,
        open:   b.open,
        high:   b.high,
        low:    b.low,
        close:  b.close,
        volume: b.volume,
      };
    } else {
      bucket.high   = Math.max(bucket.high, b.high);
      bucket.low    = Math.min(bucket.low,  b.low);
      bucket.close  = b.close;
      bucket.volume += b.volume;
    }
  });
  if (bucket) result.push(bucket);
  return result;
}

function paint(bars) {
  candleSeries.setData(bars);
  volumeSeries.setData(bars.map(b => ({ time: b.time, value: b.volume })));
}

/* ────────────────────────── Module‑level state ─────────────────────── */
let chart, candleSeries, volumeSeries;
let baseBars   = [];        // raw 5‑minute candles
let viewBars   = [];        // bars actually displayed (maybe aggregated)
let oldestCursor = null;
let isLoadingBars = false;
let currentPairId = null;
let chartDenom    = '0';
let currentTf     = '5m';

/* ────────────────────────── Chart bootstrap ────────────────────────── */
export function initEmptyChart() {
  if (chart) chart.remove();
  els.chartWrap.innerHTML = '';

  chart = LightweightCharts.createChart(els.chartWrap, {
    autoSize: true,
    layout: {
      background: { type: 'solid', color: 'rgba(0,0,0,0)' },
      textColor:  '#cbd5e1',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.05)' },
      horzLines: { color: 'rgba(255,255,255,0.05)' },
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Magnet },
    localization: {
      locale: navigator.language,
      priceFormatter: v => new Intl.NumberFormat("en-US", {
        minimumFractionDigits: PRECISION,
        maximumFractionDigits: PRECISION,
      }).format(v),
      timeFormatter: ts => new Date(ts * 1000).toLocaleString(navigator.language, {
        day:    '2-digit', month: '2-digit',
        hour:   '2-digit', minute: '2-digit', hour12: false,
      }).replace(',', ''),
    },
    rightPriceScale: {
      mode: LightweightCharts.PriceScaleMode.Logarithmic,
      borderVisible: false,
      scaleMargins: { top: 0.15, bottom: 0.15 },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
      minBarSpacing: 0.05,
      tickMarkFormatter: ts => new Date(ts * 1000).toLocaleString(navigator.language, {
        day:    '2-digit', month: '2-digit',
        hour:   '2-digit', minute: '2-digit', hour12: false,
      }).replace(',', ''),
    },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor:       '#08FBD6',
    downColor:     '#C400FF',
    wickUpColor:   '#9ca3af',
    wickDownColor: '#9ca3af',
    borderVisible: false,
    priceFormat:   { type: 'price', precision: PRECISION, minMove: 1 / 10 ** PRECISION },
  });
  candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.10, bottom: 0.30 } });

  volumeSeries = chart.addHistogramSeries({
    priceScaleId: '',
    color: '#44A4FF80',
    priceFormat: { type: 'volume' },
  });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.70, bottom: 0 } });

 
}

/* ────────────────────────── Initial load ───────────────────────────── */
// Track the current loading operation
let currentLoadingPairId = null;

export async function loadInitialCandles(pairId, denom = '0') {
  // If we're already loading this pair, don't start another load
  if (isLoadingBars && currentPairId === pairId && chartDenom === denom) {
    console.log(`Already loading candles for pair ${pairId}`);
    return;
  }
  
  // Cancel any previous visible range change subscription
  if (chart) {
    try {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleRangeChanged);
    } catch (e) {
      // Ignore errors if the chart is not fully initialized
      console.warn("Could not unsubscribe from visible range change", e);
    }
  }
  
  // Set loading state
  currentPairId = pairId;
  currentLoadingPairId = pairId;
  chartDenom = denom;
  currentTf = '5m';        // reset when switching pairs
  isLoadingBars = true;
  
  // Reset chart data
  baseBars = [];
  viewBars = [];
  oldestCursor = null;

  try {
    const page = await getPairCandles(pairId, { token: denom });
    
    // Check if we're still loading the same pair
    if (currentLoadingPairId !== pairId) {
      console.log(`Loading of candles for pair ${pairId} was cancelled`);
      return;
    }
    
    oldestCursor = page.page.before;
    baseBars = page.candles.map(toBar);
    viewBars = baseBars.slice();

    // Only paint if we're still loading the same pair
    if (currentLoadingPairId === pairId) {
      paint(viewBars);
      
      // Subscribe to visible range changes only after painting is complete
      if (chart) {
        chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleRangeChanged);
      }
    }
  } catch (error) {
    console.error(`Error loading candles for pair ${pairId}:`, error);
  } finally {
    // Only clear loading state if this is still the current loading operation
    if (currentLoadingPairId === pairId) {
      isLoadingBars = false;
      currentLoadingPairId = null;
    }
  }
}
export const getChartInstance = () => chart;

/* ────────────────────────── Time‑frame switching ───────────────────── */
export function changeTimeframe(tf) {
  if (!TF_MS[tf] || tf === currentTf) return;
  currentTf = tf;
  viewBars  = aggregate(baseBars, TF_MS[tf]);
  paint(viewBars);
  // fit the chart to new data
  chart.timeScale().fitContent();
}

/* ────────────────────────── Lazy back‑fill on scroll ───────────────── */
async function onVisibleRangeChanged(range) {
  if (isLoadingBars || !oldestCursor || !baseBars.length) return;
  if (range.from > baseBars[0].time + 1) return;   // not at extreme left

  // Store the current pair ID to check for cancellation
  const loadingPairId = currentPairId;
  const loadingDenom = chartDenom;
  
  isLoadingBars = true;
  
  try {
    const page = await getPairCandles(loadingPairId, { before: oldestCursor, token: loadingDenom });
    
    // Check if we're still on the same pair
    if (loadingPairId !== currentPairId || loadingDenom !== chartDenom) {
      console.log(`Back-fill for pair ${loadingPairId} was cancelled`);
      return;
    }
    
    const moreRaw = page.candles.map(toBar);

    // Check if we're still on the same pair
    if (loadingPairId !== currentPairId || loadingDenom !== chartDenom) {
      console.log(`Back-fill for pair ${loadingPairId} was cancelled`);
      return;
    }

    const existingTimes = new Set(baseBars.map(b => b.time));
    let unique = moreRaw.filter(b => !existingTimes.has(b.time));
    
    // last unique bar has to be updated to connect to the first bar
    if (unique.length && baseBars.length && unique[unique.length - 1].time < baseBars[0].time) {
      unique[unique.length - 1] = {
        ...unique[unique.length - 1],
        open: baseBars[0].close,
      };
    }
    
    // Check if we're still on the same pair
    if (loadingPairId !== currentPairId || loadingDenom !== chartDenom) {
      console.log(`Back-fill for pair ${loadingPairId} was cancelled`);
      return;
    }
    
    baseBars = unique.concat(baseBars);              // prepend older data
    oldestCursor = page.page.before;
    viewBars = (currentTf === '5m') ? baseBars.slice()
                                    : aggregate(baseBars, TF_MS[currentTf]);
    
    // Only paint if we're still on the same pair
    if (loadingPairId === currentPairId && loadingDenom === chartDenom) {
      paint(viewBars);
    }
  } catch (error) {
    console.error(`Error loading back-fill for pair ${loadingPairId}:`, error);
  } finally {
    // Only clear loading state if we're still on the same pair
    if (loadingPairId === currentPairId && loadingDenom === chartDenom) {
      isLoadingBars = false;
    }
  }
}

/* ────────────────────────── Live update hook ───────────────────────── */
export function upsertLastCandle(raw) {
  // Safety check - make sure we have a chart and series
  if (!chart || !candleSeries || !volumeSeries) {
    console.warn("Cannot update candle: chart or series not initialized");
    return;
  }
  
  try {
    // Fill missing open/high/low/close as original impl did ----------------
    if (raw.open == null) {
      const prevClose = baseBars.length ? baseBars[baseBars.length - 1].close : raw.close;
      raw.open   = prevClose;
      raw.high   = Math.max(prevClose, raw.close ?? prevClose);
      raw.low    = Math.min(prevClose, raw.close ?? prevClose);
      raw.close  = raw.close ?? prevClose;
      raw.volume = raw.volume ?? 0;
    }

    const bar = toBar(raw);
    
    // Safety check - make sure baseBars is initialized
    if (!Array.isArray(baseBars)) {
      console.warn("Cannot update candle: baseBars is not an array");
      return;
    }
    
    const last = baseBars.length ? baseBars[baseBars.length - 1] : null;

    if (last && last.time === bar.time) {
      baseBars[baseBars.length - 1] = bar;
    } else if (!last || bar.time > last.time) {
      baseBars.push(bar);
    } else {
      return;                    // ignore truly old data
    }

    // Update currently displayed TF --------------------------------------
    if (currentTf === '5m') {
      try {
        candleSeries.update(bar);
        volumeSeries.update({ time: bar.time, value: bar.volume });
        viewBars = baseBars;       // simple alias
      } catch (e) {
        console.warn("Error updating chart series", e);
      }
    } else {
      try {
        const bucketMs = TF_MS[currentTf];
        const aggBar   = aggregate([bar], bucketMs)[0];
        
        // Safety check - make sure viewBars is initialized
        if (!Array.isArray(viewBars)) {
          console.warn("Cannot update candle: viewBars is not an array");
          return;
        }
        
        const lastView = viewBars.length ? viewBars[viewBars.length - 1] : null;
        
        if (lastView && lastView.time === aggBar.time) {
          viewBars[viewBars.length - 1] = aggBar;
        } else if (!lastView || aggBar.time > lastView.time) {
          viewBars.push(aggBar);
        }
        
        candleSeries.update(aggBar);
        volumeSeries.update({ time: aggBar.time, value: aggBar.volume });
      } catch (e) {
        console.warn("Error updating aggregated chart series", e);
      }
    }
  } catch (error) {
    console.error("Error in upsertLastCandle:", error);
  }
}

/* ────────────────────────── Convenience exports ────────────────────── */
export function getAllBars()      { return viewBars.slice(); }
export function getLastBar()      { return viewBars.length ? viewBars[viewBars.length - 1] : null; }
export function lastUnixMs()      { return getLastBar() ? getLastBar().time * 1000 : null; }
export function rawToBar(raw)     { return toBar(raw); }
export function currentInterval() { return currentTf; }
