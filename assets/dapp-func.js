/* Assumes XianWalletUtils.init(RPC) was called somewhere earlier */
XianWalletUtils.init("https://node.xian.org");
const connectBtn = document.getElementById('connectBtn');
var userAddress = '';               // global for other calls

/* element refs */
const box = document.getElementById('tradeBox');
const pairL = document.getElementById('tbPair');
const buyT = document.getElementById('tbBuy');
const sellT = document.getElementById('tbSell');
const liquidityT = document.getElementById('tbLiquidity');
const form = document.getElementById('tbForm');
const liquidityContent = document.getElementById('tbLiquidityContent');
const amtIn = document.getElementById('tbAmount');
const priceL = document.getElementById('tbPrice');
const balL = document.getElementById('tbBalance');
const btn = document.getElementById('tbSubmit');
const getOut = document.getElementById('tbGetAmount');
const refreshLiquidityBtn = document.getElementById('tbRefreshLiquidity');
const liqToken0 = document.getElementById('liqToken0');
const liqToken1 = document.getElementById('liqToken1');
const liqShare = document.getElementById('liqShare');
const liqValue = document.getElementById('liqValue');

// Liquidity operation elements
const addLiquidityTab = document.getElementById('addLiquidityTab');
const removeLiquidityTab = document.getElementById('removeLiquidityTab');
const addLiquidityForm = document.getElementById('addLiquidityForm');
const removeLiquidityForm = document.getElementById('removeLiquidityForm');
const addToken0Amount = document.getElementById('addToken0Amount');
const addToken1Amount = document.getElementById('addToken1Amount');
const token0Balance = document.getElementById('token0Balance');
const token1Balance = document.getElementById('token1Balance');
const addLiquiditySlippage = document.getElementById('addLiquiditySlippage');
const addLiquidityBtn = document.getElementById('addLiquidityBtn');
const removePercentage = document.getElementById('removePercentage');
const removePercentageValue = document.getElementById('removePercentageValue');
const removeToken0Label = document.getElementById('removeToken0Label');
const removeToken1Label = document.getElementById('removeToken1Label');
const removeToken0Amount = document.getElementById('removeToken0Amount');
const removeToken1Amount = document.getElementById('removeToken1Amount');
const removeLiquiditySlippage = document.getElementById('removeLiquiditySlippage');
const removeLiquidityBtn = document.getElementById('removeLiquidityBtn');
const FEE = 0.003;  
let side = 'buy', pairId = null;
let _contract0 = null, _contract1 = null; // token contracts (optional)
let _sym0 = '', _sym1 = ''; // token symbols (optional)
let _price = 0; // current price (optional)
let _reserve0 = 0, _reserve1 = 0; // reserves (optional)

connectBtn.addEventListener('click', connectWallet);

const walletModal = document.getElementById('walletModal');
const wmClose     = document.getElementById('wmClose');
const wmRetry     = document.getElementById('wmRetry');
let SLIPPAGE_TOLERANCE = 0.01;    // 1 %
let userSlippage = 0.10;         // 10 % in decimal
let expectedOut = 0;                // add near top (module-scope)

function openWalletModal()  { walletModal.classList.remove('hidden'); }
function closeWalletModal() { walletModal.classList.add('hidden'); }

wmClose.onclick  = closeWalletModal;
wmRetry.onclick  = () => { closeWalletModal(); connectWallet(); };
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeWalletModal();
});


/* ————————— core logic ————————— */
async function connectWallet() {
    try {
        // Loading state
        connectBtn.innerHTML =
            `<svg class="w-5 h-5 animate-spin text-brand-cyan" 
       xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-20" cx="12" cy="12" r="10" 
            stroke="currentColor" stroke-width="4"/>
    <path  class="opacity-90" fill="currentColor"
           d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
  </svg>
  <span class="text-sm font-medium">Connecting…</span>`;
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
        
        // If on liquidity tab, fetch liquidity data
        if (side === 'liquidity') {
            fetchUserLiquidity();
        }
        window.refreshFarms();
        toast(`Connected to ${userAddress}`, 'success');

    } catch (err) {
        openWalletModal();
        console.error(err);
        resetBtn();
    }
}

/* ——— UI helpers ——— */
async function getTokenBalance(
  contract,
  address,
  retries = 5,
  backoffMs = 400,
  timeout = 5000
) {
  const url = `https://api.snaklytics.com/token/${contract}/balance/${address}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          throw new Error(`server ${res.status}`);
        }
        throw new Error(`balance api failed (${res.status})`);
      }

      const { balance = 0 } = await res.json();
      return balance;
    } catch (err) {
      clearTimeout(timer);

      const isAbort = err.name === 'AbortError';
      const isNetworkOr5xx = isAbort || (err.message && err.message.startsWith('server'));

      if (attempt === retries || !isNetworkOr5xx) throw err;

      await new Promise(r => setTimeout(r, backoffMs));
      backoffMs *= 2; // exponential back-off
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
    connectBtn.innerHTML =
        `<svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z"/></svg>
     <span class="text-sm font-medium">Connected</span>`;
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
liquidityT.onclick = () => setSide('liquidity');

function setSide(s) {
    side = s;

    /* BUY tab */
    buyT.classList.toggle('border-brand-cyan', side === 'buy');   // ON
    buyT.classList.toggle('border-transparent', side !== 'buy');   // OFF

    /* SELL tab */
    sellT.classList.toggle('border-brand-magenta', side === 'sell');
    sellT.classList.toggle('border-transparent', side !== 'sell');
    
    /* LIQUIDITY tab */
    liquidityT.classList.toggle('border-indigo-500', side === 'liquidity');
    liquidityT.classList.toggle('border-transparent', side !== 'liquidity');
    
    /* Show/hide content based on selected tab */
    form.classList.toggle('hidden', side === 'liquidity');
    liquidityContent.classList.toggle('hidden', side !== 'liquidity');

    if (side === 'buy' || side === 'sell') {
        btn.textContent = side === 'buy' ? 'Buy' + ' ' + _sym0 : 'Sell' + ' ' + _sym0;
        amtIn.placeholder = `Amount of ${side === 'buy' ? _sym1 : _sym0}`;
        amtIn.value = ''; // clear input on switch

        styleSubmitBtn();
        refreshBalanceLine();
        updateGetAmount(); 

        // ── recalc price label on side switch ────────────────
        if (_price) {
          if (side === 'buy') {
            // show "Price [price] [quote] per [base]"
            priceL.textContent = 
              `Price ${formatPrice(_price)} ${_sym1} per ${_sym0}`;
          } else {
            // invert: "Price [1/price] [base] per [quote]"
            const inv = 1 / _price;
            priceL.textContent = 
              `Price ${formatPrice(inv)} ${_sym0} per ${_sym1}`;
          }
        }
    } else if (side === 'liquidity' && userAddress) {
        // Fetch liquidity data when switching to liquidity tab
        fetchUserLiquidity();
    }
}

// Variables to store liquidity data
let _liquidityData = null;
let _token0Balance = 0;
let _token1Balance = 0;
let _userLP = 0;
let _totalLP = 0;
let _userToken0Amount = 0;
let _userToken1Amount = 0;

// Function to fetch and display user's liquidity
async function fetchUserLiquidity() {
    if (!userAddress || !pairId) {
        liqToken0.textContent = '—';
        liqToken1.textContent = '—';
        liqShare.textContent = '—';
        liqValue.textContent = '—';
        _liquidityData = null;
        return;
    }
    
    try {
        refreshLiquidityBtn.disabled = true;
        refreshLiquidityBtn.textContent = 'Loading...';
        
        // Fetch user's liquidity data directly
        const response = await fetch(`https://api.snaklytics.com/pairs/${pairId}/liquidity/${userAddress}`);
        const liquidityData = await response.json();
        _liquidityData = liquidityData;
        
        if (liquidityData && liquidityData.userLP && liquidityData.totalLP && !liquidityData.error) {
            // Store the liquidity data
            _userLP = liquidityData.userLP || 0;
            _totalLP = liquidityData.totalLP || 0;
            
            // Calculate share percentage from userLP and totalLP
            const sharePercentage = (_userLP / _totalLP) * 100;
            liqShare.textContent = `${sharePercentage.toFixed(6)}%`;
            
            // Calculate user's token amounts based on their LP share and current reserves
            if ( _contract0 === 'currency' && _contract1 === 'con_usdc') {
                // Special case for pair 1 (XIAN/USDC) where UI shows reversed order
                // For this pair, we need to invert the amounts
                _userToken1Amount = (_reserve0 * _userLP) / _totalLP; // XIAN amount
                _userToken0Amount = (_reserve1 * _userLP) / _totalLP; // USDC amount
            } else {
              _userToken0Amount = (_reserve0 * _userLP) / _totalLP;
              _userToken1Amount = (_reserve1 * _userLP) / _totalLP;
            }
            
            liqToken0.textContent = `${_userToken0Amount.toLocaleString(undefined, {maximumFractionDigits: 6})} ${_sym0}`;
            liqToken1.textContent = `${_userToken1Amount.toLocaleString(undefined, {maximumFractionDigits: 6})} ${_sym1}`;
            
            // Calculate USD value (assuming token1 is the quote token with known price)
            // For XIAN/xUSDC pair, if _sym1 is xUSDC, then userToken1Amount is already in USD
            // If _sym1 is XIAN, then we need to convert using the current price
            let usdValue;
            if (_sym1 === 'xUSDC' || _sym1 === 'USDC') {
                // Quote token is USD-pegged, so token1 amount + token0 value in USD
                usdValue = _userToken1Amount + (_userToken0Amount * _price);
            } else {
                // Both tokens need conversion, assume total value = 2 * token1 value in USD
                usdValue = _userToken1Amount * _price * 2;
            }
            
            liqValue.textContent = `$${usdValue.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
            
            // Update the remove liquidity form
            updateRemoveLiquidityForm();
            
        } else {
            _userLP = 0;
            _totalLP = 0;
            _userToken0Amount = 0;
            _userToken1Amount = 0;
            
            liqToken0.textContent = '0 ' + _sym0;
            liqToken1.textContent = '0 ' + _sym1;
            liqShare.textContent = '0%';
            liqValue.textContent = '$0';
            
            // Update the remove liquidity form
            updateRemoveLiquidityForm();
            
            
        }
        
        // Update token balances
        updateTokenBalances();
        
    } catch (error) {
        console.error('Error fetching liquidity:', error);
        liqToken0.textContent = '—';
        liqToken1.textContent = '—';
        liqShare.textContent = '—';
        liqValue.textContent = '—';
        _liquidityData = null;
        
        toast('Failed to fetch liquidity data', 'error');
    } finally {
        refreshLiquidityBtn.disabled = false;
        refreshLiquidityBtn.textContent = 'Refresh Liquidity';
    }
}



// Function to calculate optimal amounts for adding liquidity
function calculateOptimalAmounts(amount0, amount1) {
    // If the pool is empty, any ratio is fine
    if (_reserve0 === 0 && _reserve1 === 0) {
        return { amount0, amount1 };
    }
    
    // Special case for pair ID 1 (XIAN/USDC) where sides might be reversed in UI
    let currentRatio;
    if ( _contract0 === 'currency' && _contract1 === 'con_usdc') {
        // For this special pair, we need to invert the ratio
        currentRatio = _reserve0 / _reserve1;
        console.log("Special case for pair 1: inverted ratio", currentRatio);
    } else {
        // Normal case - calculate the current price ratio in the pool
        console.log("Normal case for pair", pairId, "with reserves", _reserve0, _reserve1);
        currentRatio = _reserve1 / _reserve0;
    }
    
    // Calculate the ratio of the input amounts
    const inputRatio = amount1 / amount0;
    
    // If the input ratio matches the current ratio (within a small tolerance), use as is
    const tolerance = 0.005; // 0.5% tolerance
    if (Math.abs(inputRatio / currentRatio - 1) < tolerance) {
        return { amount0, amount1 };
    }
    
    // If input ratio is higher than current ratio, token1 is limiting
    if (inputRatio > currentRatio) {
        // Calculate optimal amount0 based on amount1
        const optimalAmount0 = amount1 / currentRatio;
        return { amount0: optimalAmount0, amount1 };
    } else {
        // Calculate optimal amount1 based on amount0
        const optimalAmount1 = amount0 * currentRatio;
        return { amount0, amount1: optimalAmount1 };
    }
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

  expectedOut = out;                // store the numeric amount
  getOut.textContent = out.toLocaleString(
    undefined,
    { maximumFractionDigits: 6 }
  ) + ' ' + (side === 'buy' ? _sym0 : _sym1);
}
function formatPrice(value) {
    const num = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(num)) return '—';

    const abs = Math.abs(num);
    let dp;                          // decimals to print

    if (abs >= 1) dp = 2;   //  12.34
    else if (abs >= 0.1) dp = 4;   //   0.1234
    else if (abs >= 0.01) dp = 6;   //   0.012345
    else if (abs >= 0.001) dp = 8;   //   0.00123456
    else dp = 10;  //   0.0000123456

    return num.toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
    });
}

/* expose hook for your selectPair() */
window.updateTradeBox = ({ id, sym0, sym1, price, balance0 ="—", balance1="—", contract0, contract1, currentPrice, reserve0, reserve1, resetInputs = false }) => {
    /* update UI */
    _contract0 = contract0 || null; // optional token contracts
    _contract1 = contract1 || null;
    _sym0 = sym0;
    _sym1 = sym1;
    pairId = id;
    pairL.textContent = `${sym0} / ${sym1}`;
    priceL.textContent = `Price ${formatPrice(price)} ${sym1} per ${sym0}`;
    
    
    btn.textContent = side === 'buy' ? 'Buy ' + sym0 : 'Sell ' + sym0;
    amtIn.placeholder = `Amount of ${side === 'buy' ? sym1 : sym0}`;

    if (resetInputs) {
      // only wipe when explicitly requested (i.e. on pair change)
      balL.textContent = `Balance ${side === 'buy' ? balance1 : balance0}`;
      amtIn.value = '';
      getOut.textContent = '—';
      
      // Reset liquidity content
      liqToken0.textContent = '—';
      liqToken1.textContent = '—';
      liqShare.textContent = '—';
      liqValue.textContent = '—';
      
      // Reset liquidity forms
      addToken0Amount.value = '';
      addToken1Amount.value = '';
      token0Balance.textContent = '—';
      token1Balance.textContent = '—';
      removeToken0Label.textContent = _sym0;
      removeToken1Label.textContent = _sym1;
      removeToken0Amount.textContent = '0';
      removeToken1Amount.textContent = '0';
      
      // Reset liquidity data variables
      _liquidityData = null;
      _userLP = 0;
      _totalLP = 0;
      _userToken0Amount = 0;
      _userToken1Amount = 0;
    }

    _price = currentPrice || price; // optional current price
    _reserve0 = reserve0 || 0; // reserves (optional)
    _reserve1 = reserve1 || 0;

    if (resetInputs) {
      setSide("buy"); // default to buy side
    }
    
    // If we're on the liquidity tab and have a user address, fetch liquidity data
    if (side === 'liquidity' && userAddress) {
      fetchUserLiquidity();
    }
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
refreshLiquidityBtn.addEventListener('click', fetchUserLiquidity);

// Liquidity operation event listeners
addLiquidityTab.addEventListener('click', () => {
  addLiquidityTab.classList.add('border-emerald-500');
  addLiquidityTab.classList.remove('border-transparent');
  removeLiquidityTab.classList.add('border-transparent');
  removeLiquidityTab.classList.remove('border-rose-500');
  
  addLiquidityForm.classList.remove('hidden');
  removeLiquidityForm.classList.add('hidden');
  
  updateTokenBalances();
});

removeLiquidityTab.addEventListener('click', () => {
  removeLiquidityTab.classList.add('border-rose-500');
  removeLiquidityTab.classList.remove('border-transparent');
  addLiquidityTab.classList.add('border-transparent');
  addLiquidityTab.classList.remove('border-emerald-500');
  
  removeLiquidityForm.classList.remove('hidden');
  addLiquidityForm.classList.add('hidden');
  
  updateRemoveLiquidityForm();
});

// Update token balances when input changes
addToken0Amount.addEventListener('input', () => {
  if (addToken0Amount.value) {
    if (_reserve0 > 0 && _reserve1 > 0) {
    const amount0 = parseAmount(addToken0Amount.value);
    const optim = calculateOptimalAmounts(
      amount0,
      parseAmount(addToken1Amount.value) || 0
    );
    addToken0Amount.value = optim.amount0;
    addToken1Amount.value = optim.amount1;
  }

  }
});

addToken1Amount.addEventListener('input', () => {
  if (addToken1Amount.value) {
    if (_reserve0 > 0 && _reserve1 > 0) {
    const amount1 = parseAmount(addToken1Amount.value);
    if (amount1 > 0) {
      const optim = calculateOptimalAmounts(
        parseAmount(addToken0Amount.value) || 0,
        amount1
      );
      addToken0Amount.value = optim.amount0;
      addToken1Amount.value = optim.amount1;
    }
  }
  }
});

// Update remove percentage display and calculations
removePercentage.addEventListener('input', () => {
  const percentage = removePercentage.value;
  removePercentageValue.textContent = `${percentage}%`;
  updateRemoveLiquidityAmounts(percentage);
});

// Add liquidity button click handler
addLiquidityBtn.addEventListener('click', addLiquidity);

// Remove liquidity button click handler
removeLiquidityBtn.addEventListener('click', removeLiquidity);


/* --------------------------------------------------------------- *
 * executeTrade({ side, pairId, amount })                          *
 *   – side  : 'buy' | 'sell'  (buy → you send quote, get base)    *
 *   – pairId: router’s pair index (int)                           *
 *   – amount: amount of *input* tokens (float)                    *
 * --------------------------------------------------------------- */
async function executeTrade({ side, pairId, amount }) {
  /* ---------- 0. user must be connected ---------- */
  if (!userAddress) throw new Error('wallet not connected');
  const minOut = expectedOut * (1 - userSlippage); // slippage tolerance

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
    amountOutMin  : minOut, // min output after slippage
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


/* slippage selector */
const slipInput = document.getElementById('tbSlippage');
slipInput.addEventListener('input', () => {
  const v = parseFloat(slipInput.value);
  userSlippage = Number.isFinite(v) && v >= 0 ? v / 100 : 0;  // fallback 0 %
});

/* liquidity refresh button */
refreshLiquidityBtn.addEventListener('click', fetchUserLiquidity);

/* ═══════════════════════════════════════════════════════════════════════════════════════════════ */
/*                                    LIQUIDITY FUNCTIONS                                           */
/* ═══════════════════════════════════════════════════════════════════════════════════════════════ */

/* Update token balances for add liquidity form */
async function updateTokenBalances() {
  if (!userAddress) {
    token0Balance.textContent = '—';
    token1Balance.textContent = '—';
    return;
  }
  
  try {
    // Fetch balances for both tokens
    const balance0 = _contract0 ? await getTokenBalance(_contract0, userAddress) : 0;
    const balance1 = _contract1 ? await getTokenBalance(_contract1, userAddress) : 0;
    
    token0Balance.textContent = balance0.toLocaleString(undefined, {maximumFractionDigits: 6});
    token1Balance.textContent = balance1.toLocaleString(undefined, {maximumFractionDigits: 6});
  } catch (error) {
    console.error('Error fetching token balances:', error);
    token0Balance.textContent = '—';
    token1Balance.textContent = '—';
  }
}

/* Update remove liquidity form with current position data */
function updateRemoveLiquidityForm() {
  if (!_sym0 || !_sym1) return;
  
  removeToken0Label.textContent = _sym0;
  removeToken1Label.textContent = _sym1;
  
  // Update amounts based on current percentage
  const percentage = removePercentage.value;
  updateRemoveLiquidityAmounts(percentage);
}

/* Calculate amounts to receive when removing liquidity */
function updateRemoveLiquidityAmounts(percentage) {
  if (!_liquidityData || !_userLP || !_totalLP || _userToken0Amount <= 0 || _userToken1Amount <= 0) {
    removeToken0Amount.textContent = '—';
    removeToken1Amount.textContent = '—';
    return;
  }
  
  const removePercent = parseFloat(percentage) / 100;

  const removeToken0 = _userToken0Amount * removePercent;
  const removeToken1 = _userToken1Amount * removePercent;
  
  removeToken0Amount.textContent = removeToken0.toLocaleString(undefined, {maximumFractionDigits: 6});
  removeToken1Amount.textContent = removeToken1.toLocaleString(undefined, {maximumFractionDigits: 6});
}

/* Add liquidity function */
async function addLiquidity() {
  if (!userAddress) return toast('Connect wallet', 'error');
  
  const amount0 = parseAmount(addToken0Amount.value);
  const amount1 = parseAmount(addToken1Amount.value);
  const slippage = parseFloat(addLiquiditySlippage.value) / 100;
  
  if (!amount0 || amount0 <= 0) return toast('Enter valid amount for ' + _sym0, 'error');
  if (!amount1 || amount1 <= 0) return toast('Enter valid amount for ' + _sym1, 'error');
  if (!_contract0 || !_contract1) return toast('Token contracts not available', 'error');
  
  addLiquidityBtn.disabled = true;
  addLiquidityBtn.textContent = 'Adding Liquidity...';
  
  try {
    // The smart contract sorts tokens: if(tokenB < tokenA): tokenA, tokenB = tokenB, tokenA
    // We need to determine the correct order and amounts
    let tokenA, tokenB, amountADesired, amountBDesired;
    
    // Special case for pair ID 1 (XIAN/USDC) where UI shows reversed order
    if (pairId === 1 && _contract0 === 'currency' && _contract1 === 'con_usdc') {
      // For pair 1: UI shows XIAN/USDC but contract stores as con_usdc/currency
      // So _contract1 (con_usdc) becomes tokenA, _contract0 (currency) becomes tokenB
      tokenA = _contract1; // con_usdc
      tokenB = _contract0; // currency
      amountADesired = amount1; // USDC amount
      amountBDesired = amount0; // XIAN amount
    } else if (_contract1 < _contract0) {
      // Contract sorts them, so token1 becomes tokenA, token0 becomes tokenB
      tokenA = _contract1;
      tokenB = _contract0;
      amountADesired = amount1;
      amountBDesired = amount0;
    } else {
      // Normal order
      tokenA = _contract0;
      tokenB = _contract1;
      amountADesired = amount0;
      amountBDesired = amount1;
    }
    
    // Calculate minimum amounts with slippage tolerance
    // Use more conservative slippage for minimum amounts to avoid INSUFFICIENT_AMOUNT errors
    const conservativeSlippage = Math.max(slippage, 0.05); // At least 5% slippage tolerance
    const amountAMin = amountADesired * (1 - conservativeSlippage);
    const amountBMin = amountBDesired * (1 - conservativeSlippage);
    
    // Deadline - 5 minutes from now
    const now = new Date();
    const deadline = new Date(now.getTime() + 5 * 60 * 1000);
    const datetimeArg = {
      '__time__': [
        deadline.getUTCFullYear(),
        deadline.getUTCMonth() + 1,
        deadline.getUTCDate(),
        deadline.getUTCHours(),
        deadline.getUTCMinutes()
      ]
    };
    
    // Step 1: Approve tokenA
    await XianWalletUtils.sendTransaction(
      tokenA,
      'approve',
      { to: 'con_dex_v2', amount: amountADesired }
    );
    
    // Step 2: Approve tokenB
    await XianWalletUtils.sendTransaction(
      tokenB,
      'approve',
      { to: 'con_dex_v2', amount: amountBDesired }
    );
    
    // Step 3: Add liquidity with correct token order
    const result = await XianWalletUtils.sendTransaction(
      'con_dex_v2',
      'addLiquidity',
      {
        tokenA: tokenA,
        tokenB: tokenB,
        amountADesired: amountADesired,
        amountBDesired: amountBDesired,
        amountAMin: amountAMin,
        amountBMin: amountBMin,
        to: userAddress,
        deadline: datetimeArg
      }
    );
    
    if (result.errors) throw new Error('Add liquidity failed');
    
    toast('Liquidity added successfully!', 'success');
    
    // Clear form
    addToken0Amount.value = '';
    addToken1Amount.value = '';
    
    // Refresh data after 2 seconds
    setTimeout(() => {
      fetchUserLiquidity();
      updateTokenBalances();
    }, 2000);
    
  } catch (error) {
    console.error('Add liquidity error:', error);
    toast('Failed to add liquidity: ' + error.message, 'error');
  } finally {
    addLiquidityBtn.disabled = false;
    addLiquidityBtn.textContent = 'Add Liquidity';
  }
}

/* Remove liquidity function */
async function removeLiquidity() {
  if (!userAddress) return toast('Connect wallet', 'error');
  if (!_liquidityData || !_userLP) return toast('No liquidity position found', 'error');
  
  const percentage = parseFloat(removePercentage.value);
  const slippage = parseFloat(removeLiquiditySlippage.value) / 100;
  
  if (!percentage || percentage <= 0) return toast('Enter valid percentage to remove', 'error');
  if (!_contract0 || !_contract1) return toast('Token contracts not available', 'error');
  
  removeLiquidityBtn.disabled = true;
  removeLiquidityBtn.textContent = 'Removing Liquidity...';
  
  try {
    // Calculate liquidity amount to remove
    const liquidityToRemove = (_userLP * percentage) / 100;
    
    // Calculate expected token amounts
    const expectedToken0 = (_userToken0Amount * percentage) / 100;
    const expectedToken1 = (_userToken1Amount * percentage) / 100;
    
    // Calculate minimum amounts with slippage tolerance
    let amountAMin = expectedToken0 * (1 - slippage);
    let amountBMin = expectedToken1 * (1 - slippage);

    if (_contract0 === 'currency' && _contract1 === 'con_usdc') {
      // Special case for pair 1 (XIAN/USDC) where UI shows reversed order
      // For this pair, we need to invert the amounts
      amountAMin = expectedToken1 * (1 - slippage); // USDC amount
      amountBMin = expectedToken0 * (1 - slippage); // XIAN amount
    }
    
    // Deadline - 5 minutes from now
    const now = new Date();
    const deadline = new Date(now.getTime() + 5 * 60 * 1000);
    const datetimeArg = {
      '__time__': [
        deadline.getUTCFullYear(),
        deadline.getUTCMonth() + 1,
        deadline.getUTCDate(),
        deadline.getUTCHours(),
        deadline.getUTCMinutes()
      ]
    };
    
    // The smart contract sorts tokens: if(tokenB < tokenA): tokenA, tokenB = tokenB, tokenA
    // We need to use the same order as in addLiquidity
    let tokenA, tokenB;
    
     if (_contract1 < _contract0) {
      tokenA = _contract1;
      tokenB = _contract0;
    } else {
      tokenA = _contract0;
      tokenB = _contract1;
    }

    // First approve
    await XianWalletUtils.sendTransaction(
      'con_pairs',
      'liqApprove',
      { to: 'con_dex_v2', amount: liquidityToRemove, pair: parseInt(pairId) }
    );
    
    // Step 1: Remove liquidity (LP tokens are managed within con_dex_v2)
    const result = await XianWalletUtils.sendTransaction(
      'con_dex_v2',
      'removeLiquidity',
      {
        tokenA: tokenA,
        tokenB: tokenB,
        liquidity: liquidityToRemove,
        amountAMin: amountAMin,
        amountBMin: amountBMin,
        to: userAddress,
        deadline: datetimeArg
      }
    );
    
    if (result.errors) throw new Error('Remove liquidity failed');
    
    toast('Liquidity removed successfully!', 'success');
    
    // Reset slider
    removePercentage.value = 50;
    removePercentageValue.textContent = '50%';
    
    // Refresh data after 2 seconds
    setTimeout(() => {
      fetchUserLiquidity();
      updateTokenBalances();
    }, 2000);
    
  } catch (error) {
    console.error('Remove liquidity error:', error);
    toast('Failed to remove liquidity: ' + error.message, 'error');
  } finally {
    removeLiquidityBtn.disabled = false;
    removeLiquidityBtn.textContent = 'Remove Liquidity';
  }
}

/* Create Pair Functionality */
async function createPair(tokenA, tokenB) {
  if (!userAddress) {
    toast('Please connect your wallet first', 'error');
    return;
  }

  if (!tokenA || !tokenB) {
    toast('Both token contracts are required', 'error');
    return;
  }

  if (tokenA === tokenB) {
    toast('Token A and Token B must be different', 'error');
    return;
  }

  // Sort tokens alphabetically for consistent ordering
  // This ensures the contract receives tokens in the expected order
  const sortedTokens = [tokenA, tokenB].sort();
  const sortedTokenA = sortedTokens[0];  // First alphabetically
  const sortedTokenB = sortedTokens[1];  // Second alphabetically

  try {
    // Show loading state
    const submitBtn = document.getElementById('submitCreatePair');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Pair...';

    // Call the createPair function on con_pairs contract with sorted tokens
    const result = await XianWalletUtils.sendTransaction(
      'con_pairs',
      'createPair',
      { tokenA: sortedTokenA, tokenB: sortedTokenB }
    );

    if (result.errors) {
      throw new Error(result.errors.join(', '));
    }

    toast(`Pair created successfully! ${sortedTokenA}/${sortedTokenB}`, 'success');
    
    // Close modal
    closeCreatePairModal();
    
    // Refresh pairs list after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 2000);

  } catch (error) {
    console.error('Create pair error:', error);
    toast('Failed to create pair: ' + error.message, 'error');
  } finally {
    const submitBtn = document.getElementById('submitCreatePair');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Pair';
  }
}

/* Modal Management */
function openCreatePairModal() {
  const modal = document.getElementById('createPairModal');
  modal.classList.remove('hidden');
  
  // Focus first input
  setTimeout(() => {
    document.getElementById('tokenAInput').focus();
  }, 100);
}

function closeCreatePairModal() {
  const modal = document.getElementById('createPairModal');
  modal.classList.add('hidden');
  
  // Reset form
  document.getElementById('createPairForm').reset();
  
  // Hide info panels and errors
  document.getElementById('tokenAInfo').classList.add('hidden');
  document.getElementById('tokenBInfo').classList.add('hidden');
  document.getElementById('tokenAError').classList.add('hidden');
  document.getElementById('tokenBError').classList.add('hidden');
}

/* Token Validation and Info Display */
async function validateAndShowTokenInfo(tokenContract, infoElementId, errorElementId) {
  const infoEl = document.getElementById(infoElementId);
  const errorEl = document.getElementById(errorElementId);
  
  // Hide previous states
  infoEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  
  if (!tokenContract.trim()) {
    return false;
  }
  
  try {
    // Fetch token metadata using the global function
    const tokenMeta = await window.fetchTokenMetadata(tokenContract);
    
    if (tokenMeta) {
      // Show token info
      const isTokenA = infoElementId === 'tokenAInfo';
      const prefix = isTokenA ? 'tokenA' : 'tokenB';
      
      document.getElementById(prefix + 'Logo').src = tokenMeta.logo || './assets/ph.png';
      document.getElementById(prefix + 'Symbol').textContent = tokenMeta.symbol || tokenContract;
      document.getElementById(prefix + 'Name').textContent = tokenMeta.name || 'Unknown';
      document.getElementById(prefix + 'Supply').textContent = tokenMeta.supply ? 
        new Intl.NumberFormat().format(tokenMeta.supply) : 'Unknown';
      
      infoEl.classList.remove('hidden');
      return true;
    } else {
      throw new Error('Token metadata not found');
    }
  } catch (error) {
    console.warn('Token validation error:', error);
    errorEl.textContent = 'Invalid token contract or metadata not available';
    errorEl.classList.remove('hidden');
    return false;
  }
}

/* Event Listeners Setup */
document.addEventListener('DOMContentLoaded', function() {
  // Create Pair button event listeners
  const createPairBtn = document.getElementById('createPairBtn');
  const createPairBtnMobile = document.getElementById('createPairBtnMobile');
  
  if (createPairBtn) {
    createPairBtn.addEventListener('click', openCreatePairModal);
  }
  
  if (createPairBtnMobile) {
    createPairBtnMobile.addEventListener('click', openCreatePairModal);
  }
  
  // Modal close event listeners
  const closeModalBtn = document.getElementById('closeCreatePairModal');
  const cancelBtn = document.getElementById('cancelCreatePair');
  const modal = document.getElementById('createPairModal');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeCreatePairModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeCreatePairModal);
  }
  
  // Close modal when clicking backdrop
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeCreatePairModal();
      }
    });
  }
  
  // Form submission
  const form = document.getElementById('createPairForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const tokenA = document.getElementById('tokenAInput').value.trim();
      const tokenB = document.getElementById('tokenBInput').value.trim();
      
      // Validate both tokens before creating pair
      const tokenAValid = await validateAndShowTokenInfo(tokenA, 'tokenAInfo', 'tokenAError');
      const tokenBValid = await validateAndShowTokenInfo(tokenB, 'tokenBInfo', 'tokenBError');
      
      if (tokenAValid && tokenBValid) {
        await createPair(tokenA, tokenB);
      } else {
        toast('Please enter valid token contracts', 'error');
      }
    });
  }
  
  // Real-time token validation
  const tokenAInput = document.getElementById('tokenAInput');
  const tokenBInput = document.getElementById('tokenBInput');
  
  let tokenATimeout, tokenBTimeout;
  
  if (tokenAInput) {
    tokenAInput.addEventListener('input', function() {
      clearTimeout(tokenATimeout);
      tokenATimeout = setTimeout(() => {
        validateAndShowTokenInfo(this.value.trim(), 'tokenAInfo', 'tokenAError');
      }, 500);
    });
  }
  
  if (tokenBInput) {
    tokenBInput.addEventListener('input', function() {
      clearTimeout(tokenBTimeout);
      tokenBTimeout = setTimeout(() => {
        validateAndShowTokenInfo(this.value.trim(), 'tokenBInfo', 'tokenBError');
      }, 500);
    });
  }
  
  // Close modal with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('createPairModal');
      if (modal && !modal.classList.contains('hidden')) {
        closeCreatePairModal();
      }
    }
  });
});
