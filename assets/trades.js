/* Trade Management --------------------------------------------------------*/
import { els } from './ui.js';
import { timeAgo, formatPrice } from './utils.js';

export function prependTrades(list, meta0, meta1) {
  list.slice().reverse().forEach(t => {           // oldest-first
    const row = buildTradeRow(t, meta0, meta1);   // reuse your exact logic
    els.tradesList.insertBefore(row, els.tradesList.firstChild);
  });
  // keep table lean
  while (els.tradesList.children.length > 40) els.tradesList.lastChild.remove();
}

export function buildTradeRow(t, meta0, meta1) {
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
  else {
    amountSymbol = meta0.symbol;  // always use token0 symbol
    amount = t.amount0 || t.amount1 || 0;  // prefer token0 amount
  }
  const sym0 = meta0.symbol;
  const row = document.createElement('tr');
  row.className = `
    odd:bg-white/5 hover:bg-white/10
    transition cursor-pointer select-none`;      // new classes

  row.innerHTML = `
    <td class="px-2 py-2 text-left ${side === 'Buy' ? 'text-emerald-400' : 'text-rose-400'} whitespace-nowrap">
      ${side}
    </td>
    <td class="px-2 py-2 text-right whitespace-nowrap">
      ${amount.toLocaleString(undefined, { minFractionDigits: 2, maxFractionDigits: 4 })} ${amountSymbol}
    </td>
    <td class="px-2 py-2 text-right whitespace-nowrap">
      ${price.toLocaleString(undefined, { minFractionDigits: 2, maxFractionDigits: 8 })} ${meta1.symbol}
    </td>
    <td class="px-2 py-2 text-right text-gray-400 whitespace-nowrap">
      ${timeAgo(t.created)}
    </td>`;

  /* ───── click → explorer ───── */
  const url = `https://explorer.xian.org/tx/${t.txHash}`;
  row.addEventListener('click', () =>
    window.open(url, '_blank', 'noopener'));

  return row;
}