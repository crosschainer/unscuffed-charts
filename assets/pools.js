/* Pools page functionality */
import { API_BASE, fetchTokenMeta, getPairs, TOKEN_CACHE } from './api.js';
import { fetchJSON, formatPrice, timeAgo } from './utils.js';

// DOM elements
const els = {
  poolsList: document.getElementById('poolsList'),
  poolsSearch: document.getElementById('poolsSearch'),
  poolsScroller: document.getElementById('poolsScroller'),
  connectBtn: document.getElementById('connectBtn'),
};

// Global state
let allPools = [];
let userAddress = '';
let searchTerm = '';
const hydratingContracts = new Set();
const hydratedPairs = new Set();

// Initialize the pools page
document.addEventListener('DOMContentLoaded', initPools);

async function initPools() {
  // Check if we're on the pools page
  if (!document.getElementById('poolsPage')) return;
  
  // Setup search functionality
  els.poolsSearch.addEventListener('input', onSearch);
  
  try {
    // Fetch all pairs/pools
    const rawPairs = (await getPairs({ limit: 1031 })).pairs;
    allPools = rawPairs;
    
    // Render the pools list
    renderPoolsList(allPools);
  } catch (err) {
    console.error('Failed to load pools:', err);
  }
  
  // Check wallet connection status
  checkWalletConnection();
}

function onSearch(e) {
  searchTerm = e.target.value.toLowerCase().trim();
  renderPoolsList(allPools);
}

function matchesSearch(pool) {
  if (!searchTerm) return true;
  
  return (
    pool.token0.toLowerCase().includes(searchTerm) ||
    pool.token1.toLowerCase().includes(searchTerm) ||
    (TOKEN_CACHE[pool.token0]?.symbol || '').toLowerCase().includes(searchTerm) ||
    (TOKEN_CACHE[pool.token1]?.symbol || '').toLowerCase().includes(searchTerm)
  );
}

async function renderPoolsList(pools) {
  if (!els.poolsList) return;
  
  // Clear the current list
  els.poolsList.innerHTML = '';
  
  // Filter pools based on search
  const filteredPools = pools.filter(matchesSearch);
  
  // Create pool items
  for (const pool of filteredPools) {
    const poolItem = createPoolItem(pool);
    els.poolsList.appendChild(poolItem);
    
    // Hydrate metadata asynchronously
    hydrateMetadataIfNeeded(pool).then(() => {
      // Update the pool item with metadata
      const updatedItem = createPoolItem(pool);
      const existingItem = document.querySelector(`[data-pool-id="${pool.pair}"]`);
      if (existingItem) {
        existingItem.replaceWith(updatedItem);
      }
    }).catch(err => {
      console.warn(`Failed to hydrate metadata for pool ${pool.pair}:`, err);
    });
  }
}

function createPoolItem(pool) {
  const meta0 = TOKEN_CACHE[pool.token0] ?? { symbol: pool.token0, logo: '' };
  const meta1 = TOKEN_CACHE[pool.token1] ?? { symbol: pool.token1, logo: '' };
  
  const div = document.createElement('div');
  div.className = 'border border-white/5 rounded-md mb-3 overflow-hidden';
  div.setAttribute('data-pool-id', pool.pair);
  
  // Pool header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-4 cursor-pointer hover:bg-white/5';
  header.onclick = () => togglePoolDetails(pool.pair);
  
  // Token logos and names
  const logoSrc0 = meta0.logo || './assets/ph.png';
  const logoSrc1 = meta1.logo || './assets/ph.png';
  
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="flex -space-x-2">
        <img src="${logoSrc0}" class="w-8 h-8 rounded-full border border-white/10" 
             alt="${meta0.symbol}" onerror="this.onerror=null;this.src='./assets/ph.png';">
        <img src="${logoSrc1}" class="w-8 h-8 rounded-full border border-white/10" 
             alt="${meta1.symbol}" onerror="this.onerror=null;this.src='./assets/ph.png';">
      </div>
      <span class="font-medium">${meta0.symbol} / ${meta1.symbol}</span>
    </div>
    <svg class="w-5 h-5 text-gray-400 transform transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 9l-7 7-7-7"></path>
    </svg>
  `;
  
  // Pool details (initially hidden)
  const details = document.createElement('div');
  details.className = 'hidden border-t border-white/5 p-4 bg-brand-card/50';
  details.id = `pool-details-${pool.pair}`;
  
  details.innerHTML = `
    <div class="mb-4">
      <div class="text-sm text-gray-400 mb-1">Tokens</div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img src="${logoSrc0}" class="w-5 h-5 rounded-full" 
                 alt="${meta0.symbol}" onerror="this.onerror=null;this.src='./assets/ph.png';">
            <span>${meta0.symbol}</span>
          </div>
          <div class="text-xs text-gray-400 truncate max-w-[200px]" title="${pool.token0}">${pool.token0}</div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img src="${logoSrc1}" class="w-5 h-5 rounded-full" 
                 alt="${meta1.symbol}" onerror="this.onerror=null;this.src='./assets/ph.png';">
            <span>${meta1.symbol}</span>
          </div>
          <div class="text-xs text-gray-400 truncate max-w-[200px]" title="${pool.token1}">${pool.token1}</div>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Add Liquidity Form -->
      <div class="border border-white/10 rounded-md p-3">
        <h3 class="text-sm font-medium mb-3 text-brand-cyan">Add Liquidity</h3>
        <form id="add-liquidity-form-${pool.pair}" class="flex flex-col gap-3">
          <div>
            <label class="text-xs text-gray-400 mb-1 block">${meta0.symbol} Amount</label>
            <input type="number" min="0" step="any" class="w-full bg-white/5 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-cyan" 
                   placeholder="0.0" id="add-token0-amount-${pool.pair}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">${meta1.symbol} Amount</label>
            <input type="number" min="0" step="any" class="w-full bg-white/5 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-cyan" 
                   placeholder="0.0" id="add-token1-amount-${pool.pair}" required>
          </div>
          <div class="flex justify-between items-center text-xs text-gray-400">
            <span>Slippage Tolerance</span>
            <input type="number" min="0.1" step="0.1" class="w-16 bg-white/5 rounded-md px-2 py-1 text-right" 
                   value="1.0" id="add-slippage-${pool.pair}">
          </div>
          <button type="submit" class="mt-2 py-2 rounded-md font-medium bg-brand-cyan text-gray-900 hover:bg-brand-cyan/90 transition-colors disabled:bg-brand-cyan/30 disabled:text-white disabled:cursor-not-allowed">
            Add Liquidity
          </button>
        </form>
      </div>
      
      <!-- Remove Liquidity Form -->
      <div class="border border-white/10 rounded-md p-3">
        <h3 class="text-sm font-medium mb-3 text-brand-magenta">Remove Liquidity</h3>
        <form id="remove-liquidity-form-${pool.pair}" class="flex flex-col gap-3">
          <div>
            <label class="text-xs text-gray-400 mb-1 block">LP Token Amount</label>
            <input type="number" min="0" step="any" class="w-full bg-white/5 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-magenta" 
                   placeholder="0.0" id="remove-lp-amount-${pool.pair}" required>
            <div class="text-xs text-gray-400 mt-1">
              <span>Your LP Balance: </span>
              <span id="lp-balance-${pool.pair}">Loading...</span>
            </div>
          </div>
          <div class="flex justify-between items-center text-xs text-gray-400">
            <span>Slippage Tolerance</span>
            <input type="number" min="0.1" step="0.1" class="w-16 bg-white/5 rounded-md px-2 py-1 text-right" 
                   value="1.0" id="remove-slippage-${pool.pair}">
          </div>
          <button type="submit" class="mt-2 py-2 rounded-md font-medium bg-brand-magenta text-gray-900 hover:bg-brand-magenta/90 transition-colors disabled:bg-brand-magenta/30 disabled:text-white disabled:cursor-not-allowed">
            Remove Liquidity
          </button>
        </form>
      </div>
    </div>
  `;
  
  div.appendChild(header);
  div.appendChild(details);
  
  return div;
}

function togglePoolDetails(poolId) {
  const details = document.getElementById(`pool-details-${poolId}`);
  const poolItem = document.querySelector(`[data-pool-id="${poolId}"]`);
  const arrow = poolItem.querySelector('svg');
  
  if (details.classList.contains('hidden')) {
    details.classList.remove('hidden');
    arrow.classList.add('rotate-180');
    
    // Load LP token balance if user is connected
    if (userAddress) {
      loadLpBalance(poolId);
    }
    
    // Add event listeners for forms
    setupLiquidityForms(poolId);
  } else {
    details.classList.add('hidden');
    arrow.classList.remove('rotate-180');
  }
}

async function hydrateMetadataIfNeeded(pair) {
  const key = pair.pair;
  
  // Already done? We're good.
  if (hydratedPairs.has(key)) return;
  
  // Wait for both tokens
  await Promise.all(
    [pair.token0, pair.token1].map(async (token) => {
      if (TOKEN_CACHE[token]) return;
      
      // Dedup concurrent fetches
      if (!hydratingContracts.has(token)) {
        hydratingContracts.add(token);
        try {
          const meta = await fetchTokenMeta(token);
          TOKEN_CACHE[token] = meta;
        } catch (err) {
          console.warn(`Token metadata failed for ${token}`, err);
        } finally {
          hydratingContracts.delete(token);
        }
      }
      
      // Wait for another ongoing fetch to complete
      while (!TOKEN_CACHE[token]) {
        await new Promise(r => setTimeout(r, 100)); // poll
      }
    })
  );
  
  // At this point: both token0 + token1 are in cache
  if (!hydratedPairs.has(key)) {
    hydratedPairs.add(key);
  }
}

async function checkWalletConnection() {
  try {
    const info = await XianWalletUtils.requestWalletInfo();
    if (!info.locked) {
      userAddress = info.address;
      // Update UI to show connected state
      const connectBtn = document.getElementById('connectBtn');
      if (connectBtn) {
        connectBtn.innerHTML = `
          <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z"/></svg>
          <span class="text-sm font-medium">Connected</span>
        `;
      }
    }
  } catch (err) {
    console.warn('Wallet not connected:', err);
  }
}

async function loadLpBalance(poolId) {
  if (!userAddress) return;
  
  const balanceElement = document.getElementById(`lp-balance-${poolId}`);
  if (!balanceElement) return;
  
  try {
    // Fetch LP token balance from the API
    const response = await fetchJSON(`https://node.xian.org/abci_query?path=%22/get/con_pairs.pairs:${poolId}:balances:${userAddress}%22`);
    
    if (response && response.result && response.result.response) {
      const balanceData = response.result.response;
      
      if (balanceData.value) {
        // Parse the balance value
        const balance = parseFloat(balanceData.value);
        balanceElement.textContent = balance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });
      } else {
        balanceElement.textContent = '0.00';
      }
    } else {
      balanceElement.textContent = '0.00';
    }
  } catch (err) {
    console.error('Failed to load LP balance:', err);
    balanceElement.textContent = 'Error loading balance';
  }
}

function setupLiquidityForms(poolId) {
  const addForm = document.getElementById(`add-liquidity-form-${poolId}`);
  const removeForm = document.getElementById(`remove-liquidity-form-${poolId}`);
  
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAddLiquidity(poolId);
    });
  }
  
  if (removeForm) {
    removeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleRemoveLiquidity(poolId);
    });
  }
}

async function handleAddLiquidity(poolId) {
  if (!userAddress) {
    toast('Please connect your wallet first', 'error');
    return;
  }
  
  const pool = allPools.find(p => p.pair === poolId);
  if (!pool) {
    toast('Pool not found', 'error');
    return;
  }
  
  const token0AmountInput = document.getElementById(`add-token0-amount-${poolId}`);
  const token1AmountInput = document.getElementById(`add-token1-amount-${poolId}`);
  const slippageInput = document.getElementById(`add-slippage-${poolId}`);
  
  const token0Amount = parseFloat(token0AmountInput.value);
  const token1Amount = parseFloat(token1AmountInput.value);
  const slippagePercent = parseFloat(slippageInput.value) / 100;
  
  if (isNaN(token0Amount) || token0Amount <= 0 || isNaN(token1Amount) || token1Amount <= 0) {
    toast('Please enter valid amounts', 'error');
    return;
  }
  
  // Calculate minimum amounts based on slippage
  const token0Min = token0Amount * (1 - slippagePercent);
  const token1Min = token1Amount * (1 - slippagePercent);
  
  // Create deadline (5 minutes from now)
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
  
  try {
    // First approve token0
    await XianWalletUtils.sendTransaction(
      pool.token0,
      'approve',
      { to: 'con_dex_v2', amount: token0Amount }
    );
    
    // Then approve token1
    await XianWalletUtils.sendTransaction(
      pool.token1,
      'approve',
      { to: 'con_dex_v2', amount: token1Amount }
    );
    
    // Finally add liquidity
    const result = await XianWalletUtils.sendTransaction(
      'con_dex_v2',
      'addLiquidity',
      {
        tokenA: pool.token0,
        tokenB: pool.token1,
        amountADesired: token0Amount,
        amountBDesired: token1Amount,
        amountAMin: token0Min,
        amountBMin: token1Min,
        to: userAddress,
        deadline: datetimeArg
      }
    );
    
    if (result.errors) {
      throw new Error('Add liquidity failed');
    }
    
    toast('Liquidity added successfully', 'success');
    
    // Clear inputs
    token0AmountInput.value = '';
    token1AmountInput.value = '';
    
    // Refresh LP balance after a short delay
    setTimeout(() => {
      loadLpBalance(poolId);
    }, 2000);
    
  } catch (err) {
    console.error('Add liquidity error:', err);
    toast('Failed to add liquidity', 'error');
  }
}

async function handleRemoveLiquidity(poolId) {
  if (!userAddress) {
    toast('Please connect your wallet first', 'error');
    return;
  }
  
  const pool = allPools.find(p => p.pair === poolId);
  if (!pool) {
    toast('Pool not found', 'error');
    return;
  }
  
  const lpAmountInput = document.getElementById(`remove-lp-amount-${poolId}`);
  const slippageInput = document.getElementById(`remove-slippage-${poolId}`);
  
  const lpAmount = parseFloat(lpAmountInput.value);
  const slippagePercent = parseFloat(slippageInput.value) / 100;
  
  if (isNaN(lpAmount) || lpAmount <= 0) {
    toast('Please enter a valid LP token amount', 'error');
    return;
  }
  
  // Get reserves to calculate minimum amounts
  try {
    const reserves = await fetchJSON(`${API_BASE}/pairs/${poolId}/reserves`);
    const reserve0 = parseFloat(reserves.reserve0 || 0);
    const reserve1 = parseFloat(reserves.reserve1 || 0);
    
    // Get total supply of LP tokens
    const lpBalanceResponse = await fetchJSON(`https://node.xian.org/abci_query?path=%22/get/con_pairs.pairs:${poolId}:total_supply%22`);
    let totalSupply = 0;
    
    if (lpBalanceResponse && lpBalanceResponse.result && lpBalanceResponse.result.response && lpBalanceResponse.result.response.value) {
      totalSupply = parseFloat(lpBalanceResponse.result.response.value);
    }
    
    if (totalSupply <= 0) {
      throw new Error('Could not determine LP token total supply');
    }
    
    // Calculate expected token amounts based on proportion of LP tokens
    const expectedAmount0 = (lpAmount / totalSupply) * reserve0;
    const expectedAmount1 = (lpAmount / totalSupply) * reserve1;
    
    // Apply slippage tolerance
    const minAmount0 = expectedAmount0 * (1 - slippagePercent);
    const minAmount1 = expectedAmount1 * (1 - slippagePercent);
    
    // Create deadline (5 minutes from now)
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
    
    // First approve LP tokens
    await XianWalletUtils.sendTransaction(
      `con_pairs.pairs:${poolId}`,
      'approve',
      { to: 'con_dex_v2', amount: lpAmount }
    );
    
    // Then remove liquidity
    const result = await XianWalletUtils.sendTransaction(
      'con_dex_v2',
      'removeLiquidity',
      {
        tokenA: pool.token0,
        tokenB: pool.token1,
        liquidity: lpAmount,
        amountAMin: minAmount0,
        amountBMin: minAmount1,
        to: userAddress,
        deadline: datetimeArg
      }
    );
    
    if (result.errors) {
      throw new Error('Remove liquidity failed');
    }
    
    toast('Liquidity removed successfully', 'success');
    
    // Clear input
    lpAmountInput.value = '';
    
    // Refresh LP balance after a short delay
    setTimeout(() => {
      loadLpBalance(poolId);
    }, 2000);
    
  } catch (err) {
    console.error('Remove liquidity error:', err);
    toast('Failed to remove liquidity', 'error');
  }
}

// Toast notification helper
function toast(message, type = 'success') {
  const wrap = document.getElementById('toastContainer');
  if (!wrap) return;
  
  // Toast element
  const el = document.createElement('div');
  el.className = `
    flex items-center gap-2
    px-4 py-2 rounded shadow-lg text-sm text-white
    ${type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}
    opacity-0 translate-y-2 scale-95
    transition-all duration-200
    pointer-events-auto`;
  
  el.innerHTML = `
    ${type === 'error'
      ? '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/><path d="M1 21h22L12 2 1 21z"/></svg>'
      : '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'}
    <span>${message}</span>
  `;
  
  wrap.appendChild(el);
  
  // Animate in on next frame
  requestAnimationFrame(() =>
    el.classList.remove('opacity-0', 'translate-y-2', 'scale-95'));
  
  // Auto-remove after 3s + fade out
  setTimeout(() => {
    el.classList.add('opacity-0', 'translate-y-2', 'scale-95');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3000);
}

export { initPools };