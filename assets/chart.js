/* LightweightCharts wrapper ----------------------------------------------*/
import { els } from './ui.js';
import { getPairCandles } from './api.js';

let chart, candleSeries, volumeSeries;
let allBars = [];
let oldestCursor = null;
let isLoadingBars = false;
let currentPairId = null;
let chartDenom = '0';   // 0 = Xian, 1 = USD
let chartInterval = '5m';

export function initEmptyChart() {
    if (chart) chart.remove();

    els.chartWrap.innerHTML = '';  // clear previous chart


    chart = LightweightCharts.createChart(els.chartWrap, {
        width: els.chartWrap.clientWidth,
        height: Math.max(300, els.chartWrap.clientHeight || 0),
        layout: { background: { type: 'solid', color: 'rgba(0,0,0,0)' }, textColor: '#cbd5e1' },
        grid: {
            vertLines: { color: 'rgba(255,255,255,0.05)' },
            horzLines: { color: 'rgba(255,255,255,0.05)' }
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Magnet },
        localization: {
            locale: navigator.language,
            priceFormatter: v => new Intl.NumberFormat(navigator.language, {
                minimumFractionDigits: 6, maximumFractionDigits: 6,
            }).format(v),
            timeFormatter: ts => {
     // ts is the same seconds number you passed in setData / update
     return new Date(ts * 1000)      // js wants milliseconds
       .toLocaleString(navigator.language, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');
   },
        },
        rightPriceScale: {
            mode: LightweightCharts.PriceScaleMode.Logarithmic,
            borderVisible: false,
            scaleMargins: { top: 0.15, bottom: 0.15 }
        },
        timeScale: {
            borderVisible: false, timeVisible: true, secondsVisible: false,
            rightOffset: 5, minBarSpacing: 0.05,
            tickMarkFormatter: ts => {
  const date = new Date(ts * 1000);
  return date.toLocaleString(navigator.language, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');
}
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#08FBD6', downColor: '#C400FF',
        wickUpColor:'#9ca3af', wickDownColor:'#9ca3af',     // Tailwind slate-400
        borderVisible: false,
        priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.10, bottom: 0.30 } });

    volumeSeries = chart.addHistogramSeries({
        priceScaleId: '', color: '#44A4FF80', priceFormat: { type: 'volume' },
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.70, bottom: 0 } });

    window.addEventListener('resize', () =>
        chart.applyOptions({
            width: els.chartWrap.clientWidth,
            height: Math.max(300, els.chartWrap.clientHeight), // fallback
        }));
        new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    chart.applyOptions({ width, height });
  }).observe(els.chartWrap);
}

export async function loadInitialCandles(pairId, denom = '0') {
    chartInterval = '5m';  // default interval
    chartDenom = denom;
    currentPairId = pairId;
    isLoadingBars = true;

    const page = await getPairCandles(pairId, { token: denom });
    oldestCursor = page.page.before;
    allBars = page.candles.map(toBar);

    candleSeries.setData(allBars);
    volumeSeries.setData(allBars.map(b => ({ time: b.time, value: b.volume })));
    chart.timeScale().fitContent();

    isLoadingBars = false;
    chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleRangeChanged);
}

/* ----------------------------------------------------------------------- */
async function onVisibleRangeChanged(range) {
    if (isLoadingBars || !oldestCursor) return;
    if (range.from > allBars[0].time + 1) return;       // not at the far left yet

    isLoadingBars = true;
    console.log(oldestCursor, 'loading more candles…');
    const page = await getPairCandles(currentPairId, { before: oldestCursor, token: chartDenom });
    const more = page.candles.map(toBar);

       // 1) filter out any exact‐time duplicates
    const existTimes = new Set(allBars.map(b => b.time));
    const moreFiltered = more.filter(b => !existTimes.has(b.time));

    // 2) stitch the boundary so close→open is continuous
    if (moreFiltered.length && allBars.length) {
      const lastNew = moreFiltered[moreFiltered.length - 1];
      const firstOld = allBars[0];
      // if there’s a tiny price jump, force the open to equal last close
      if (Math.abs(lastNew.close - firstOld.open) > 1e-12) {
        firstOld.open = lastNew.close;
        firstOld.high = Math.max(firstOld.high, firstOld.open);
        firstOld.low  = Math.min(firstOld.low,  firstOld.open);
      }
    }
    // 3) merge them
    allBars = moreFiltered.concat(allBars);

    candleSeries.setData(allBars);
    volumeSeries.setData(allBars.map(b => ({ time: b.time, value: b.volume })));

    oldestCursor = page.page.before;
    isLoadingBars = false;
}

function toBar(c) {
      // add a “Z” if the backend forgot it so Date() parses in UTC
  const iso = c.t.endsWith('Z') ? c.t : c.t + 'Z';
  return {
      time: Math.floor(Date.parse(iso) / 1000),
        open: c.open, high: c.high,
        low: c.low, close: c.close,
        volume: c.volume,
    };
}
export function getBarAt(unixMs) {
  const t = Math.floor(unixMs/1000);
  return allBars.find(b => b.time === t) || null;
}
export function getLastBar() {
  return allBars.length ? allBars[allBars.length - 1] : null;
}
export function rawToBar(raw) {
  return toBar(raw);
}
export function upsertLastCandle(raw) {
   // 1) carry forward open if needed
  if (raw.open == null) {
    const prevClose = allBars.length
      ? allBars[allBars.length - 1].close
      : raw.close;
    raw.open   = prevClose;
    raw.high   = Math.max(prevClose, raw.close ?? prevClose);
    raw.low    = Math.min(prevClose, raw.close ?? prevClose);
    raw.close  = raw.close ?? prevClose;
    raw.volume = raw.volume ?? 0;
  }

  // 2) build our bar object
  const bar = toBar(raw);
  const last = allBars[allBars.length - 1];

  // 3) insert or replace in our local array
  if (last && last.time === bar.time) {
    allBars[allBars.length - 1] = bar;
  } else if (!last || bar.time > last.time) {
    allBars.push(bar);
  } else {
    // strictly older → we skip updating the chart, but keep our array unchanged
    return;
  }

  // 4) now update the chart, catching & swallowing only the
  //    “Cannot update oldest data” error
  try {
    // update both series with the same bar;
    // .update() will append if it's a new time, else replace
    candleSeries.update(bar);
    volumeSeries.update({ time: bar.time, value: bar.volume });
  } catch (err) {
    if (!/Cannot update oldest data/.test(err.message)) {
      // Unexpected errors bubble up
      throw err;
    }
    // Otherwise: fine, we tried to update truly stale data and
    // the chart rejected it—ignore.
  }
}
// unix-milliseconds of the newest bar we have
export function lastUnixMs() {
  return allBars.length ? allBars[allBars.length - 1].time * 1000 : null;
}

// (optional) whichever interval was used for the initial load (“5m”, “1h”…)
export function currentInterval() {
  return chartInterval;          // see change just below
}