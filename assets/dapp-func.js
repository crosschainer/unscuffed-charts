/* Assumes XianWalletUtils.init(RPC) was called somewhere earlier */
XianWalletUtils.init("https://node.xian.org");
const connectBtn = document.getElementById('connectBtn');
let userAddress = '';               // global for other calls

/* element refs */
const box = document.getElementById('tradeBox');
const pairL = document.getElementById('tbPair');
const buyT = document.getElementById('tbBuy');
const sellT = document.getElementById('tbSell');
const form = document.getElementById('tbForm');
const amtIn = document.getElementById('tbAmount');
const priceL = document.getElementById('tbPrice');
const balL = document.getElementById('tbBalance');
const btn = document.getElementById('tbSubmit');
const getOut = document.getElementById('tbGetAmount');
const FEE = 0.003;  
let side = 'buy', pairId = null;
let _contract0 = null, _contract1 = null; // token contracts (optional)
let _sym0 = '', _sym1 = ''; // token symbols (optional)
let _price = 0; // current price (optional)
let _reserve0 = 0, _reserve1 = 0; // reserves (optional)

connectBtn.addEventListener('click', connectWallet);

/* ————————— core logic ————————— */
async function connectWallet() {
    try {

        const info = await XianWalletUtils.requestWalletInfo();

        if (info.locked) {
            toast('Unlock your Xian Wallet first', 'error');
            resetBtn(); return;
        }


        /* success! */
        userAddress = info.address;
        showAddress(userAddress);
        updateTradeBtn();
        styleSubmitBtn();
        refreshBalanceLine();
        toast(`Connected to ${userAddress}`, 'success');

    } catch (err) {
        toast('Wallet not found or user rejected', 'error');
        console.error(err);
        resetBtn();
    }
}

/* ——— UI helpers ——— */
async function getTokenBalance(contract, address,
                               retries = 3, backoffMs = 400) {
  const url = `https://xian-api.poc.workers.dev/token/${contract}/balance/${address}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);

      // retry only on server-side errors (5xx)
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          throw new Error(`server ${res.status}`);
        }
        throw new Error(`balance api failed (${res.status})`);
      }

      const { balance = 0 } = await res.json();
      return balance;
    } catch (err) {
      if (attempt === retries) throw err;          // ran out of tries

      // network error or 5xx → wait & retry
      await new Promise(r => setTimeout(r, backoffMs));
      backoffMs *= 2;                              // exponential back-off
    }
  }
}

/* ------------------------------------------------------------------ *
 *  parseAmount(str)                                                  *
 *    - Accepts both “1,23” and “1.23” (and grouping chars)           *
 *    - Works for most European & US locales                          *
 * ------------------------------------------------------------------ */
function parseAmount(raw) {
  if (!raw) return NaN;

  // remove spaces or thin-spaces used as group separators
  let s = raw.trim().replace(/\s+/g, '');

  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');

  if (hasComma && hasDot) {
    // Decide which is decimal: assume the *right-most* separator is decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '');      // drop dots (thousands)
      s = s.replace(',', '.');       // comma → decimal
    } else {
      s = s.replace(/,/g, '');       // drop commas (thousands)
      // dot already decimal
    }
  } else if (hasComma && !hasDot) {
    // Only comma present → it’s the decimal separator
    s = s.replace(',', '.');
  } else {
    // only dots (or none) → nothing to do
  }

  return parseFloat(s);
}

function showAddress(addr) {
    addr = addr.slice(0, 6) + '...' + addr.slice(-4);
    connectBtn.innerHTML =
        `<svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z"/></svg>
     <span class="text-sm font-medium">Connected: ${addr}</span>`;
    // unfocus button
    connectBtn.blur();
}

function resetBtn() {
    connectBtn.innerHTML =
        `<svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z"/></svg>
     <span class="text-sm font-medium">Connect Wallet</span>`;
}

function updateTradeBtn() {
    const disabled = !userAddress;
    btn.disabled = disabled;
}
async function refreshBalanceLine() {
  if (!userAddress) { balL.textContent = 'Balance —'; return; }

  const contract = side === 'buy' ?  _contract1 : _contract0; // token to spend
  try {
    const bal = await getTokenBalance(contract, userAddress);
    balL.textContent = `Balance ${bal.toLocaleString(undefined,{maximumFractionDigits:6})} ${side === 'buy' ? _sym1 : _sym0}`;
  } catch { balL.textContent = 'Balance 0'; }
}
function styleSubmitBtn() {
    const disabled = !userAddress;

    /* background */
    btn.classList.toggle('bg-brand-cyan/30', disabled && side === 'buy');
    btn.classList.toggle('bg-brand-magenta/30', disabled && side === 'sell');
    btn.classList.toggle('cursor-not-allowed', disabled);

    const activeBuy = !disabled && side === 'buy';
    const activeSell = !disabled && side === 'sell';

    btn.classList.toggle('bg-brand-cyan', activeBuy);
    btn.classList.toggle('bg-brand-magenta', activeSell);

    /* text colour: darker for bright backgrounds */
    btn.classList.toggle('text-gray-900', !disabled); // dark text when enabled
    btn.classList.toggle('text-white', disabled);
}

/* tab switch */
buyT.onclick = () => setSide('buy');
sellT.onclick = () => setSide('sell');
function setSide(s) {
    side = s;

    /* BUY tab */
    buyT.classList.toggle('border-brand-cyan', side === 'buy');   // ON
    buyT.classList.toggle('border-transparent', side !== 'buy');   // OFF

    /* SELL tab */
    sellT.classList.toggle('border-brand-magenta', side === 'sell');
    sellT.classList.toggle('border-transparent', side !== 'sell');

    btn.textContent = side === 'buy' ? 'Buy' + ' ' + _sym0 : 'Sell' + ' ' + _sym0;
    amtIn.placeholder = `Amount of ${side === 'buy' ? _sym1 : _sym0}`;
    amtIn.value = ''; // clear input on switch

    styleSubmitBtn();
    refreshBalanceLine();
    updateGetAmount(); 
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amtAfterFee = amountIn * (1 - FEE);
  return (amtAfterFee * reserveOut) / (reserveIn + amtAfterFee);
}

function updateGetAmount() {
  const raw = amtIn.value;
  const amountIn = parseAmount(raw);
  if (!amountIn || amountIn <= 0 ||
      _reserve0 === 0 || _reserve1 === 0) {
    getOut.textContent = '—';
    return;
  }

  let out;
  
 if (side === 'buy' && _contract0 == "currency") {
    out = getAmountOut(amountIn, _reserve0, _reserve1);
} else if (side === 'sell' && _contract0 == "currency") {
    out = getAmountOut(amountIn, _reserve1, _reserve0);
    } 
else if (side === 'buy' && _contract1 == "currency") {
    out = getAmountOut(amountIn, _reserve1, _reserve0);
} else if (side === 'sell' && _contract1 == "currency") {
    out = getAmountOut(amountIn, _reserve0, _reserve1);
}    


  getOut.textContent = out.toLocaleString(
    undefined,
    { maximumFractionDigits: 6 }
  ) + ' ' + (side === 'buy' ? _sym0 : _sym1);
}


/* expose hook for your selectPair() */
window.updateTradeBox = ({ id, sym0, sym1, price, balance0, balance1, contract0, contract1, currentPrice, reserve0, reserve1 }) => {
    /* update UI */
    _contract0 = contract0 || null; // optional token contracts
    _contract1 = contract1 || null;
    _sym0 = sym0;
    _sym1 = sym1;
    pairId = id;
    pairL.textContent = `${sym0} / ${sym1}`;
    priceL.textContent = `Price ${price}`;
    balL.textContent = `Balance ${side === 'buy' ? balance1 : balance0}`;
    btn.textContent = side === 'buy' ? 'Buy' + ' ' + sym0 : 'Sell' + ' ' + sym0;
    amtIn.placeholder = `Amount of ${side === 'buy' ? sym1 : sym0}`;
    amtIn.value = ''; // clear input on pair change
    getOut.textContent = '—'; // reset output
    _price = currentPrice || price; // optional current price
    _reserve0 = reserve0 || 0; // reserves (optional)
    _reserve1 = reserve1 || 0;
    setSide("buy"); // default to buy side
    console.log(_price);
};

/* submit */
form.onsubmit = async e => {
    e.preventDefault();
    if (!userAddress) return toast('Connect wallet', 'error');

    const amt = parseAmount(amtIn.value);
    if (!amt) return toast('Enter amount', 'error');

    btn.disabled = true; btn.textContent = '…';
    try {
        await executeTrade({ side, pairId, amount: amt });
        toast('Trade sent');
        amtIn.value = '';
    } catch (err) {
        console.error(err); toast('Trade failed', 'error');
    } finally {
        btn.disabled = false; btn.textContent = side === 'buy' ? 'Buy' : 'Sell';
    }
};

amtIn.addEventListener('input', updateGetAmount);


/* --------------------------------------------------------------- *
 * executeTrade({ side, pairId, amount })                          *
 *   – side  : 'buy' | 'sell'  (buy → you send quote, get base)    *
 *   – pairId: router’s pair index (int)                           *
 *   – amount: amount of *input* tokens (float)                    *
 * --------------------------------------------------------------- */
async function executeTrade({ side, pairId, amount }) {
  /* ---------- 0. user must be connected ---------- */
  if (!userAddress) throw new Error('wallet not connected');

  /* ---------- 1. approve router to pull <amount> ---------- */
  /* If you BUY base → you spend quote (token1). If you SELL → spend base.   *
   * Replace token0 / token1 with the actual contract names if you have them */
  const inputToken = side === 'buy' ? _contract1 : _contract0; // token to spend

  await XianWalletUtils.sendTransaction(
    inputToken,
    'approve',
    { to: 'con_dex_v2', amount }
  );                                           // throws if rejected



  /* deadline – 5 minutes from now */
  const now      = new Date();
  const deadline = new Date(now.getTime() + 5 * 60 * 1000);
  const datetimeArg = {
    '__time__': [
      deadline.getUTCFullYear(),
      deadline.getUTCMonth() + 1,              // JS months 0-11
      deadline.getUTCDate(),
      deadline.getUTCHours(),
      deadline.getUTCMinutes()
    ]
  };

  const kwargs = {
    amountIn      : amount,
    amountOutMin  : 0,
    pair          : parseInt(pairId), // pair index
    src           : side === 'buy' ? _contract1 : _contract0, // token to spend
    to            : userAddress,               // receives output here
    deadline      : datetimeArg
  };

  /* ---------- 3. perform the swap ---------- */
  const result = await XianWalletUtils.sendTransaction(
    'con_dex_v2',
    'swapExactTokenForTokenSupportingFeeOnTransferTokens',
    kwargs
  );

  if (result.errors) throw new Error('swap failed');

  /* ---------- 4. success toast ---------- */
  toast(`${side === 'buy' ? 'Bought' : 'Sold'} ${amount} tokens`, 'success');
  setTimeout(() => {
    /* refresh balance line after 2 s */
    refreshBalanceLine();
  }, 2000);
}



updateTradeBtn();
styleSubmitBtn();

/* tiny toast helper (optional) */
/* ─── Tailwind toast helper ───────────────────────────────────────── */
function toast(message, type = 'success') {
    const wrap = document.getElementById('toastContainer');

    // ✦ toast element
    const el = document.createElement('div');
    el.className = `
    flex items-center gap-2
    px-4 py-2 rounded shadow-lg text-sm text-white
    ${type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}
    opacity-0 translate-y-2 scale-95
    transition-all duration-200
    pointer-events-auto`;               // allows hover / dismiss later

    el.innerHTML = `
    ${type === 'error'
            ? '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/><path d="M1 21h22L12 2 1 21z"/></svg>'
            : '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'}
    <span>${message}</span>
  `;

    wrap.appendChild(el);

    // animate in on next frame
    requestAnimationFrame(() =>
        el.classList.remove('opacity-0', 'translate-y-2', 'scale-95'));

    // auto-remove after 3 s + fade out
    setTimeout(() => {
        el.classList.add('opacity-0', 'translate-y-2', 'scale-95');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 3000);
}


