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
         hour:   '2-digit',
         minute: '2-digit',
         day:    '2-digit',
         month:  'short',
         hour12: false               // drop for AM/PM
       });
   },
        },
        rightPriceScale: {
            mode: LightweightCharts.PriceScaleMode.Logarithmic,
            borderVisible: false,
            scaleMargins: { top: 0.15, bottom: 0.15 }
        },
        timeScale: {
            borderVisible: false, timeVisible: true, secondsVisible: false,
            rightOffset: 5, minBarSpacing: 0.05
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#08FBD6', downColor: '#C400FF',
        wickUpColor:'#9ca3af', wickDownColor:'#9ca3af',     // Tailwind slate-400
        borderVisible: false,
        priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0.30 } });

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
    const page = await getPairCandles(currentPairId, { before: oldestCursor, token: chartDenom });
    const more = page.candles.map(toBar);


       // ── remove the bucket we already have ────────────────────────────────
   if (more.length && allBars.length &&
      more[more.length - 1].time === allBars[0].time) {
       more.pop();                     // drop the duplicate overlap bar
   }

    allBars = more.concat(allBars);

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
export function upsertLastCandle(raw) {
  const bar = toBar(raw);                  // you already have toBar()
  const last = allBars[allBars.length - 1];

  if (last && last.time === bar.time) {
    // replace existing candle
    allBars[allBars.length - 1] = bar;
    candleSeries.update(bar);
    volumeSeries.update({ time: bar.time, value: bar.volume });
  } else {
    // push new candle
    allBars.push(bar);
    candleSeries.update(bar);
    volumeSeries.update({ time: bar.time, value: bar.volume });
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