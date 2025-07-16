/* Pair Page Management ----------------------------------------------------*/
import { els, showMainSkeleton } from './ui.js';
import * as api from './api.js';
import * as chart from './chart.js';
import { setPairHash, formatPrice } from './utils.js';
import { currencyUsdPrice, ivMs } from './state.js';
import { paintPrice, paintVolume, paintLiquidity, updateMarketCap } from './ui-updates.js';
import { prependTrades } from './trades.js';
import { 
  setCurrentTradesWs, 
  setCurrentPriceChangeWs, 
  setCurrentVolumeWs, 
  setCurrentReservesWs, 
  setCurrentCandlesWs,
  closePairWebSockets 
} from './websockets.js';

export async function selectPair(pairId) {
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

  console.log(meta0);

  /* pair logo -------------------------------------------------------- */
  els.pairLogo.src = meta0.logo || './assets/ph.png';
  els.pairLogo.onerror = () => {
    els.pairLogo.src = './assets/ph.png';
  };

  els.pairName.textContent = `${meta0.symbol} / ${meta1.symbol}`;
  els.infoTokenName.textContent = meta0.name || meta0.symbol;
  els.infoTokenSymbol.textContent = meta0.symbol;
  els.infoTokenSupply.textContent = meta0.supply.toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }) || 'Unknown';
  els.infoTokenOperator.innerHTML = `<a href="https://xian.org/addresses/${meta0.operator}" target="_blank" rel="noopener" class="hover:underline">${meta0.operator}</a>` || 'Unknown';
  els.infoTokenExplorer.innerHTML = `<a href="${meta0.explorer}" target="_blank" rel="noopener" class="hover:underline">${meta0.explorer}</a>`;

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

  // Calculate and display market cap
  updateMarketCap(priceNow, meta0, meta1);

  paintPrice(priceNow, pct, meta1);
  paintVolume(vol24h);
  paintLiquidity(usdLiq);

  /* 4) chart -------------------------------------------------------------*/
  chart.initEmptyChart();
  await chart.loadInitialCandles(pairId, chartDenom);
  document.querySelector('.tf-btn.active')?.classList.remove('active');
  document.querySelector('.tf-btn[data-tf="5m"]')?.classList.add('active');

  // Back-fill any missing 5m bars up to the current slot
  fillMissingCandles();

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

  /* 5) tear down any old sockets -----------------------------------------*/
  closePairWebSockets();

  /* 6) wire up live updates ----------------------------------------------*/
  setupPairWebSockets(pairId, denomPrice, denomVol, denomTrades, chartDenom, meta0, meta1, tradeBoxState);
}

function fillMissingCandles() {
  const bars = chart.getAllBars();
  if (bars.length < 2) return;
  
  for (let i = 1; i < bars.length; i++) {
    const prevTs = bars[i - 1].time * 1000;
    const currTs = bars[i].time * 1000;
    const missed = Math.floor((currTs - prevTs) / ivMs) - 1;
    for (let j = 1; j <= missed; j++) {
      chart.upsertLastCandle({
        t: prevTs + ivMs * j,
        open: bars[i - 1].close,
        high: bars[i - 1].close,
        low: bars[i - 1].close,
        close: bars[i - 1].close,
        volume: 0,
      });
    }
  }
  
  // Fill the "incomplete" current interval
  const last = chart.getLastBar();
  const nextSlot = Math.floor(Date.now() / ivMs) * ivMs;
  if (nextSlot > last.time * 1000) {
    chart.upsertLastCandle({
      t: nextSlot,
      open: last.close,
      high: last.close,
      low: last.close,
      close: last.close,
      volume: 0,
    });
  }
  chart.getChartInstance?.().timeScale().fitContent?.();
}

function setupPairWebSockets(pairId, denomPrice, denomVol, denomTrades, chartDenom, meta0, meta1, tradeBoxState) {
  // Price change WebSocket
  setCurrentPriceChangeWs(api.subscribePairPriceChange24h(pairId, denomPrice, {
    onOpen: () => {
      console.log('Price WS open for', pairId);
      document.getElementById('live-dot').classList.add('connected');
    },
    onError: err => {
      console.error('Price WS error', err);
      document.getElementById('live-dot').classList.remove('connected');
    },
    onData: d => {
      const newPrice = d.priceNow ?? d.price;
      const newPct = d.changePct ?? d.percentChange ?? 0;
      tradeBoxState.price = newPrice;
      paintPrice(newPrice, newPct, meta1);
      
      updateTradeBox({
        ...tradeBoxState,
        currentPrice: newPrice,
      });
      
      updateMarketCap(newPrice, meta0, meta1);
    }
  }));

  // Volume WebSocket
  setCurrentVolumeWs(api.subscribePairVolume24h(pairId, denomVol, {
    onData: d => {
      paintVolume(d.volume24h * currencyUsdPrice);
    }
  }));

  // Reserves WebSocket
  setCurrentReservesWs(api.subscribePairReserves(pairId, {
    onData: d => {
      tradeBoxState.reserve0 = d.reserve0 || 0;
      tradeBoxState.reserve1 = d.reserve1 || 0;
      updateTradeBox({
        ...tradeBoxState,
        currentPrice: tradeBoxState.price,
      });
      paintLiquidity(Number(d.reserve1) * currencyUsdPrice * 2);
    },
    onError: err => console.error('Reserves WS error', err),
    onOpen: () => console.log('Reserves WS open'),
  }));

  // Candles WebSocket
  setCurrentCandlesWs(api.subscribePairCandles(pairId, chartDenom, "5m", {
    onOpen: () => console.log('Candles WS connected for', pairId),
    onError: err => console.error('Candles WS error', err),
    onData: incomingCandle => {
      if (!incomingCandle || !incomingCandle.t) return;

      const last = chart.getLastBar();
      if (last) {
        const lastTs = last.time * 1000;
        const newTs = incomingCandle.t;
        const missed = Math.floor((newTs - lastTs) / ivMs) - 1;
        
        for (let i = 1; i <= missed; i++) {
          const emptyTs = lastTs + ivMs * i;
          chart.upsertLastCandle({
            t: emptyTs,
            open: last.close,
            high: last.close,
            low: last.close,
            close: last.close,
            volume: 0
          });
        }
      }

      chart.upsertLastCandle(incomingCandle);
    }
  }));

  // Trades WebSocket
  setupTradesWebSocket(pairId, denomTrades, meta0, meta1);
}

function setupTradesWebSocket(pairId, denomTrades, meta0, meta1) {
  let firstTrade = true;
  let lastTradeTs = 0;
  
  setCurrentTradesWs(api.subscribePairTrades(pairId, denomTrades, {
    onData: payload => {
      const incoming = (payload.trades || [])
        .filter(t => new Date(t.created).getTime() > lastTradeTs)
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      if (!incoming.length) {
        if (firstTrade) {
          els.tradesList.innerHTML = '';
          firstTrade = false;
        }
        return;
      }

      if (firstTrade) {
        els.tradesList.innerHTML = '';
        firstTrade = false;
      }

      prependTrades(incoming, meta0, meta1);

      lastTradeTs = Math.max(
        lastTradeTs,
        ...incoming.map(t => new Date(t.created).getTime())
      );
    },
    onError: err => console.error('Trades WS error', err),
    onOpen: () => console.log('Connected to live trades for', pairId),
  }));
}

// Use the global functions from dapp-func.js
function updateTradeBox(state) {
  if (window.updateTradeBox) {
    window.updateTradeBox(state);
  }
}

function refreshBalanceLine() {
  if (window.refreshBalanceLine) {
    window.refreshBalanceLine();
  }
}