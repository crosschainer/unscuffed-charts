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

// Track the current pair selection operation
let currentPairSelectionId = null;
let isSelectingPair = false;

export async function selectPair(pairId) {
  // If we're already selecting this pair, don't do anything
  if (isSelectingPair && currentPairSelectionId === pairId) {
    return;
  }
  
  // Cancel any ongoing pair selection
  if (isSelectingPair) {
    console.log(`Cancelling selection of pair ${currentPairSelectionId} to select ${pairId}`);
  }
  
  // Set the new selection state
  isSelectingPair = true;
  currentPairSelectionId = pairId;
  const thisSelectionId = pairId; // Capture the current selection ID for comparison later
  
  // Close existing WebSockets first to prevent race conditions
  closePairWebSockets();
  
  setPairHash(pairId);  // update URL hash
  showMainSkeleton();

  try {
    /* 1) basic info --------------------------------------------------------*/
    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }
    
    let { token0, token1 } = await api.getPair(pairId);
    let denomPrice = 1, denomVol = 1, denomTrades = 1, chartDenom = '1';
    if (token0 === 'con_usdc' && token1 === 'currency') {
      [token0, token1] = [token1, token0];
      denomPrice = 0; chartDenom = '0';
    }

    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }

    const meta0 = await api.fetchTokenMeta(token0);
    const meta1 = await api.fetchTokenMeta(token1);

    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }

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

    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }

    /* 2) concurrent data ---------------------------------------------------*/
    const [priceD, volD, tradesD, resD] = await Promise.all([
      api.get24hPriceChange(pairId, denomPrice),
      api.get24hVolume(pairId, denomVol),
      api.getPairTrades(pairId, { token: denomTrades }),
      api.getPairReserves(pairId),
    ]);

    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }

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

    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }

    /* 4) chart -------------------------------------------------------------*/
    chart.initEmptyChart();
    await chart.loadInitialCandles(pairId, chartDenom);
    
    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }
    
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

    // Check if the selection was cancelled before continuing
    if (currentPairSelectionId !== thisSelectionId) {
      console.log(`Selection of pair ${thisSelectionId} was cancelled`);
      return;
    }

    /* 6) wire up live updates ----------------------------------------------*/
    setupPairWebSockets(pairId, denomPrice, denomVol, denomTrades, chartDenom, meta0, meta1, tradeBoxState);
    
  } catch (error) {
    console.error(`Error selecting pair ${pairId}:`, error);
  } finally {
    // Only clear the selection state if this is still the current selection
    if (currentPairSelectionId === thisSelectionId) {
      isSelectingPair = false;
    }
  }
}

function fillMissingCandles() {
  try {
    const bars = chart.getAllBars();
    if (!Array.isArray(bars) || bars.length < 2) return;
    
    for (let i = 1; i < bars.length; i++) {
      if (!bars[i-1] || !bars[i] || typeof bars[i-1].time !== 'number' || typeof bars[i].time !== 'number') {
        console.warn("Invalid bar data encountered during fillMissingCandles");
        continue;
      }
      
      const prevTs = bars[i - 1].time * 1000;
      const currTs = bars[i].time * 1000;
      const missed = Math.floor((currTs - prevTs) / ivMs) - 1;
      
      // Only fill reasonable gaps (avoid filling huge gaps that might be due to data issues)
      if (missed > 0 && missed < 100) { // Limit to 100 candles to prevent excessive filling
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
    }
    
    // Fill the "incomplete" current interval
    const last = chart.getLastBar();
    if (last && typeof last.time === 'number' && last.close !== undefined) {
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
    }
    
    // Safely fit content
    const chartInstance = chart.getChartInstance?.();
    if (chartInstance && typeof chartInstance.timeScale === 'function') {
      const timeScale = chartInstance.timeScale();
      if (timeScale && typeof timeScale.fitContent === 'function') {
        timeScale.fitContent();
      }
    }
  } catch (error) {
    console.error("Error in fillMissingCandles:", error);
  }
}

function setupPairWebSockets(pairId, denomPrice, denomVol, denomTrades, chartDenom, meta0, meta1, tradeBoxState) {
  // Store the current pair ID to check in callbacks
  const currentSetupPairId = pairId;
  
  // Price change WebSocket
  const priceChangeCallbacks = {
    onOpen: () => {
      console.log('Price WS open for', pairId);
    },
    onError: err => {
      console.error('Price WS error', err);
    },
    onData: d => {
      // Check if we're still on the same pair
      if (currentPairSelectionId !== currentSetupPairId) {
        console.log(`Ignoring price update for old pair ${currentSetupPairId}`);
        return;
      }
      
      try {
        const newPrice = d.priceNow ?? d.price;
        const newPct = d.changePct ?? d.percentChange ?? 0;
        tradeBoxState.price = newPrice;
        paintPrice(newPrice, newPct, meta1);
        
        updateTradeBox({
          ...tradeBoxState,
          currentPrice: newPrice,
        });
        
        updateMarketCap(newPrice, meta0, meta1);
      } catch (error) {
        console.error("Error processing price update:", error);
      }
    }
  };
  setCurrentPriceChangeWs(
    api.subscribePairPriceChange24h(pairId, denomPrice, priceChangeCallbacks),
    { pairId, denomPrice, callbacks: priceChangeCallbacks }
  );

  // Volume WebSocket
  const volumeCallbacks = {
    onData: d => {
      // Check if we're still on the same pair
      if (currentPairSelectionId !== currentSetupPairId) {
        console.log(`Ignoring volume update for old pair ${currentSetupPairId}`);
        return;
      }
      
      try {
        paintVolume(d.volume24h * currencyUsdPrice);
      } catch (error) {
        console.error("Error processing volume update:", error);
      }
    }
  };
  setCurrentVolumeWs(
    api.subscribePairVolume24h(pairId, denomVol, volumeCallbacks),
    { pairId, denomVol, callbacks: volumeCallbacks }
  );

  // Reserves WebSocket
  const reservesCallbacks = {
    onData: d => {
      // Check if we're still on the same pair
      if (currentPairSelectionId !== currentSetupPairId) {
        console.log(`Ignoring reserves update for old pair ${currentSetupPairId}`);
        return;
      }
      
      try {
        tradeBoxState.reserve0 = d.reserve0 || 0;
        tradeBoxState.reserve1 = d.reserve1 || 0;
        updateTradeBox({
          ...tradeBoxState,
          currentPrice: tradeBoxState.price,
        });
        paintLiquidity(Number(d.reserve1) * currencyUsdPrice * 2);
      } catch (error) {
        console.error("Error processing reserves update:", error);
      }
    },
    onError: err => console.error('Reserves WS error', err),
    onOpen: () => console.log('Reserves WS open'),
  };
  setCurrentReservesWs(
    api.subscribePairReserves(pairId, reservesCallbacks),
    { pairId, callbacks: reservesCallbacks }
  );

  // Candles WebSocket
  const candlesCallbacks = {
    onOpen: () => console.log('Candles WS connected for', pairId),
    onError: err => console.error('Candles WS error', err),
    onData: incomingCandle => {
      // Check if we're still on the same pair
      if (currentPairSelectionId !== currentSetupPairId) {
        console.log(`Ignoring candle update for old pair ${currentSetupPairId}`);
        return;
      }
      
      try {
        if (!incomingCandle || !incomingCandle.t) return;

        const last = chart.getLastBar();
        if (last && typeof last.time === 'number' && last.close !== undefined) {
          const lastTs = last.time * 1000;
          const newTs = incomingCandle.t;
          const missed = Math.floor((newTs - lastTs) / ivMs) - 1;
          
          // Only fill reasonable gaps (avoid filling huge gaps that might be due to data issues)
          if (missed > 0 && missed < 20) { // Limit to 20 candles to prevent excessive filling
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
        }

        chart.upsertLastCandle(incomingCandle);
      } catch (error) {
        console.error("Error processing candle update:", error);
      }
    }
  };
  setCurrentCandlesWs(
    api.subscribePairCandles(pairId, chartDenom, "5m", candlesCallbacks),
    { pairId, token: chartDenom, interval: "5m", callbacks: candlesCallbacks }
  );

  // Trades WebSocket
  setupTradesWebSocket(pairId, denomTrades, meta0, meta1);
}

function setupTradesWebSocket(pairId, denomTrades, meta0, meta1) {
  let firstTrade = true;
  let lastTradeTs = 0;
  
  // Store the current pair ID to check in callbacks
  const currentSetupPairId = pairId;
  
  const tradesCallbacks = {
    onData: payload => {
      // Check if we're still on the same pair
      if (currentPairSelectionId !== currentSetupPairId) {
        console.log(`Ignoring trades update for old pair ${currentSetupPairId}`);
        return;
      }
      
      try {
        const incoming = (payload.trades || [])
          .filter(t => {
            try {
              return new Date(t.created).getTime() > lastTradeTs;
            } catch (e) {
              console.warn("Invalid trade date:", t.created);
              return false;
            }
          })
          .sort((a, b) => {
            try {
              return new Date(b.created) - new Date(a.created);
            } catch (e) {
              return 0;
            }
          });

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

        // Safely calculate the max timestamp
        const timestamps = incoming
          .map(t => {
            try {
              return new Date(t.created).getTime();
            } catch (e) {
              return 0;
            }
          })
          .filter(ts => ts > 0);
          
        if (timestamps.length > 0) {
          lastTradeTs = Math.max(lastTradeTs, ...timestamps);
        }
      } catch (error) {
        console.error("Error processing trades update:", error);
      }
    },
    onError: err => console.error('Trades WS error', err),
    onOpen: () => console.log('Connected to live trades for', pairId),
  };
  
  setCurrentTradesWs(
    api.subscribePairTrades(pairId, denomTrades, tradesCallbacks),
    { pairId, token: denomTrades, callbacks: tradesCallbacks }
  );
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