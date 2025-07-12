/* UI Update Functions -----------------------------------------------------*/
import { els } from './ui.js';
import { formatPrice } from './utils.js';
import { currencyUsdPrice } from './state.js';

export function blinkLive() {
  const dot = document.getElementById('live-dot');
  if (dot) dot.classList.toggle('opacity-0');
}

export function tickUpdated() {
  const el = document.querySelector('#last-updated time');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString();
}

export function paintPrice(price, pct, meta1) {
  if (price == null || pct == null) return;
  els.price.textContent = `${formatPrice(price)} ${meta1.symbol}`;
  els.delta.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  els.delta.className = `${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-medium`;
  els.priceM.textContent = els.price.textContent;

  els.deltaM.textContent = els.delta.textContent;
  els.deltaM.classList.remove('text-emerald-400', 'text-rose-400');
  els.deltaM.classList.add(`${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`);
}

export function paintVolume(vol) {
  if (vol == null) return;
  els.volume.textContent = `$${vol.toLocaleString()}`;
  els.volumeM.textContent = els.volume.textContent;
}

export function paintLiquidity(liq) {
  if (liq == null) return;
  els.liquidity.textContent = `$${liq.toLocaleString(undefined, {
    minFractionDigits: 2, maxFractionDigits: 2
  })}`;
  els.liquidityM.textContent = els.liquidity.textContent;
}

export function updateMarketCap(newPrice, meta0, meta1) {
  let marketCap;
  if (meta1.symbol === 'xUSDC') {
    // Special case for the native currency (XIAN)
    marketCap = newPrice * meta0.supply;
  } else {
    marketCap = currencyUsdPrice * newPrice * (meta0.supply || 0);
  }
  
  if (isNaN(marketCap) || !isFinite(marketCap)) {
    els.infoTokenMarketCap.textContent = 'Unknown';
  } else {
    els.infoTokenMarketCap.textContent = '$' + marketCap.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}