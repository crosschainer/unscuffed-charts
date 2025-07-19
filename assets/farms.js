/* assets/farms.js  ────────────────────────────────────────────────────
 * Plain old script (no import / export).  Builds farm cards into
 * #farmsView, refreshes them from RPC, and listens for wallet connect.
 */

(() => {
  const GRID = document.querySelector('#farmsView section'); // grid container
  const LOADING = document.getElementById('farmsLoading');   // loading indicator
  const FARMS_TXT = 'farms.txt';                             // 1 line / farm
  const farms = [];                                          // live instances
  let isLoading = false;                                     // loading state

  /* ---------- card constructor ------------------------------------- */
  /* ---------- card constructor ------------------------------------- */
function createCard(meta) {
  const el = document.createElement('article');
  el.className =
    'flex flex-col bg-brand-card rounded-lg border border-white/5 ' +
    'shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden';

  /* template */
  el.innerHTML = /*html*/`
    <!-- header with gradient accent -->
    <div class="relative">
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-cyan to-brand-magenta"></div>
      <div class="flex items-center gap-3 p-4 pt-5 border-b border-white/5">
        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-brand-cyan/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="title font-semibold text-lg leading-tight">${meta.title}</h3>
          <p class="pair text-xs text-gray-400 flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            Pool #${meta.pairIdx}
          </p>
        </div>
      </div>
    </div>

    <!-- quick stats with improved visual hierarchy -->
    <dl class="stats flex flex-col gap-4 p-5 text-sm bg-white/[0.02]">
      <div class="flex justify-between items-center">
        <dt class="text-gray-400 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          APR
        </dt>
        <dd class="apr font-medium text-brand-cyan text-lg">—</dd>
      </div>
      <div class="flex justify-between items-center">
        <dt class="text-gray-400 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Reward
        </dt>
        <dd class="reward font-medium">${meta.reward}</dd>
      </div>
      <div class="flex justify-between items-center">
        <dt class="text-gray-400 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ends
        </dt>
        <dd class="ends font-medium">—</dd>
      </div>
    </dl>

    <!-- interaction with improved UX -->
    <details class="mt-auto border-t border-white/5 group">
      <summary
        class="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-sm
               hover:bg-white/5 transition-colors duration-150">
        <span class="font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Manage Position
        </span>
        <svg class="w-5 h-5 shrink-0 transition-transform duration-200 group-open:-rotate-180 text-brand-cyan"
             viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </summary>

      <div class="body px-5 pt-4 space-y-4 bg-white/[0.02]">
        <div class="p-3 rounded bg-white/5 border border-white/10">
          <p class="text-xs text-gray-400 font-medium mb-2">
            Your Position
          </p>
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-400">Your Stake:</span>
            <span class="mystake text-gray-200 font-medium">—</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-400">Wallet Balance:</span>
            <span class="bal text-gray-200 font-medium">—</span>
          </div>
        </div>

        <div class="relative">
          <input type="number" min="0" step="any" inputmode="decimal" placeholder="0.0"
                 class="amount w-full rounded bg-white/5 px-3 py-3 text-right
                    focus:outline-none focus:ring-2 focus:ring-brand-cyan
                    border border-white/10 transition-all duration-200">
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
            LP
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 pb-4">
          <button class="stake py-2.5 rounded-md text-sm font-medium
                         bg-brand-cyan text-brand-base hover:bg-brand-cyan/90
                         transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50">
            Stake LP
          </button>
          <button class="unstake py-2.5 rounded-md text-sm font-medium
                         bg-white/10 hover:bg-white/20 transition-colors duration-200
                         focus:outline-none focus:ring-2 focus:ring-white/30">
            Withdraw LP
          </button>
        </div>

        <div class="p-3 rounded bg-white/5 border border-white/10 mb-4">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-400">Harvestable Rewards:</span>
            <span class="earned text-brand-cyan font-medium">0</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Token: <span class="font-medium">${meta.reward}</span>
          </div>
        </div>
        
        <div class="pb-4">
          <button class="harvest rounded-md text-sm font-medium w-full py-2.5
                         bg-brand-magenta/80 text-white hover:bg-brand-magenta
                         transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-brand-magenta/50" disabled>
            Harvest Rewards
          </button>
        </div>
      </div>
    </details>
  `;


  /* cached selectors */
  const $ = (sel) => el.querySelector(sel);
  const $apr     = $('.apr');
  const $tvl     = $('.tvl');
  const $stake   = $('.mystake');
  const $bal     = $('.bal');
  const $earned  = $('.earned');
  const $ends    = $('.ends');
  const $amount  = $('.amount');
  const $harvest = $('.harvest');

  /* helper */
  const fmt = (x, dp = 2) =>
    Number(x).toLocaleString("en-US", { maximumFractionDigits: dp });

  /* ---------------- refresh from RPC ---------------- */
  async function refresh() {
    try {
      // Add loading state to the card
      el.classList.add('relative');
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg';
      loadingOverlay.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-2 border-t-2 border-brand-cyan"></div>';
      el.appendChild(loadingOverlay);
      
      // Fetch farm data
      const infoJson = await getFarmsInfo(
        'con_staking_mc1',
        userAddress || '',
        [meta.farm]                // single farm
      );
      
      // Parse data
      const data = JSON.parse(infoJson.replace(/'/g, '"'))[0];
      if (!data) {
        throw new Error('No data returned for farm');
      }
      
      console.log('Farm data:', data);
      let start;
      let end;
      let rps;
      let totalStk;
      let rewardCon;
      let usrLiq;
      let usrStk;
      let usrRew;
      
      if (userAddress) {
        [start, end, rps, totalStk, pairIdx, rewardCon, usrLiq, usrStk, usrRew] = data;
      } else {
        [start, end, rps, totalStk, rewardCon] = data;
      }

      // Get LP token value
      let tvlRaw = await RPCcall(
        'con_staking_mc1',
        'lpvalue_xian',
        userAddress || '',
        { dexpairs: 'con_pairs', pairs: [meta.pairIdx] }
      );
      tvlRaw = Number(JSON.parse(tvlRaw.replace(/'/g, '"'))[0]); // tvlRaw is how much 1 LP is worth

      /* APR with animation */
      if (+totalStk > 0) {
        console.log(rps, totalStk, tvlRaw);
        const apr = (Number(rps) * 31_556_926 / (Number(totalStk) * Number(tvlRaw))) * 100;
        
        // Animate APR update
        const oldValue = $apr.textContent.replace('%', '') || '0';
        const newValue = fmt(apr);
        
        if (parseFloat(oldValue) !== parseFloat(newValue)) {
          $apr.classList.add('text-brand-cyan', 'transition-all', 'duration-500');
          $apr.textContent = newValue + '%';
          
          // Highlight change
          if (parseFloat(newValue) > parseFloat(oldValue)) {
            $apr.classList.add('text-emerald-400');
            setTimeout(() => $apr.classList.remove('text-emerald-400'), 1000);
          } else if (parseFloat(newValue) < parseFloat(oldValue)) {
            $apr.classList.add('text-red-400');
            setTimeout(() => $apr.classList.remove('text-red-400'), 1000);
          }
        } else {
          $apr.textContent = newValue + '%';
        }
      } else {
        $apr.textContent = '0%';
      }

      /* Ends date with better formatting */
      if (end) {
        const d = new Date(`${end}Z`);
        const now = new Date();
        const diffTime = Math.abs(d - now);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // Format date
        const dateStr = d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        const timeStr = d.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Show relative time if within 30 days
        if (diffDays < 30) {
          $ends.innerHTML = `
            <span class="text-brand-cyan">${dateStr}</span> ${timeStr}
            <span class="block text-xs text-gray-400 mt-1">(in ${diffDays} days)</span>
          `;
        } else {
          $ends.innerHTML = `<span class="text-brand-cyan">${dateStr}</span> ${timeStr}`;
        }
      } else {
        $ends.textContent = 'No end date';
      }

      // Update user-specific data if connected
      if (userAddress) {
        /* user stake / rewards with animation */
        const oldStake = $stake.textContent || '0';
        const newStake = fmt(usrStk, 6);
        
        if (parseFloat(oldStake) !== parseFloat(newStake)) {
          $stake.classList.add('transition-all', 'duration-500');
          
          if (parseFloat(newStake) > parseFloat(oldStake)) {
            $stake.classList.add('text-emerald-400');
            setTimeout(() => $stake.classList.remove('text-emerald-400'), 1000);
          } else if (parseFloat(newStake) < parseFloat(oldStake)) {
            $stake.classList.add('text-red-400');
            setTimeout(() => $stake.classList.remove('text-red-400'), 1000);
          }
        }
        
        $stake.textContent = newStake;
        
        // Update rewards
        const oldRewards = $earned.textContent || '0';
        const newRewards = fmt(usrRew, 4);
        
        if (parseFloat(oldRewards) !== parseFloat(newRewards)) {
          $earned.classList.add('transition-all', 'duration-500');
          
          if (parseFloat(newRewards) > parseFloat(oldRewards)) {
            $earned.classList.add('text-emerald-400');
            setTimeout(() => $earned.classList.remove('text-emerald-400'), 1000);
          }
        }
        
        $earned.textContent = newRewards;
        
        // Enable/disable harvest button
        $harvest.disabled = !(usrRew > 0);
        
        if (usrRew > 0) {
          $harvest.classList.remove('bg-brand-magenta/80');
          $harvest.classList.add('bg-brand-magenta', 'animate-pulse');
        } else {
          $harvest.classList.remove('bg-brand-magenta', 'animate-pulse');
          $harvest.classList.add('bg-brand-magenta/80');
        }

        /* wallet balance */
        try {
          const bal = await getLiq("con_pairs", meta.pairIdx, userAddress);
          $bal.textContent = fmt(bal, 6);
        } catch (err) {
          console.warn('Failed to get liquidity balance:', err);
          $bal.textContent = '—';
        }
      } else {
        // Not connected - show placeholders
        $stake.textContent = '—';
        $earned.textContent = '0';
        $bal.textContent = '—';
        $harvest.disabled = true;
      }
      
      return true; // Success
    } catch (error) {
      console.error('Failed to refresh farm data:', error);
      
      // Update UI to show error state
      $apr.textContent = '—';
      $ends.textContent = '—';
      
      if (userAddress) {
        $stake.textContent = '—';
        $earned.textContent = '—';
        $bal.textContent = '—';
      }
      
      // Add error indicator to the card
      el.classList.add('border-red-500/50');
      setTimeout(() => el.classList.remove('border-red-500/50'), 2000);
      
      return false; // Failed
    } finally {
      // Remove loading overlay
      const overlay = el.querySelector('div.absolute');
      if (overlay) {
        overlay.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => overlay.remove(), 300);
      }
    }
  }

  /* ---------------- button handlers ----------------- */
  async function stakeTx(amt, button) {
    if (amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return false;
    }
    
    try {
      // Show loading state on button
      const originalText = button.textContent;
      button.innerHTML = `
        <div class="flex items-center justify-center gap-2">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-t-2 border-brand-base"></div>
          <span>Approving...</span>
        </div>
      `;
      button.disabled = true;
      
      // First transaction - approve
      await XianWalletUtils.sendTransaction(
        "con_pairs",
        'liqApprove',
        {
          pair: parseInt(meta.pairIdx),
          amount: amt,
          to: meta.farm
        }
      );
      
      // Update button state for second transaction
      button.innerHTML = `
        <div class="flex items-center justify-center gap-2">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-t-2 border-brand-base"></div>
          <span>Staking...</span>
        </div>
      `;
      
      // Second transaction - deposit
      await XianWalletUtils.sendTransaction(
        meta.farm,
        'deposit',
        {
          amount: amt
        }
      );
      
      // Success
      showToast(`Successfully staked ${fmt(amt)} LP tokens`, 'success');
      return true;
    } catch (error) {
      console.error('Staking failed:', error);
      showToast('Failed to stake LP tokens. Please try again.', 'error');
      return false;
    } finally {
      // Reset button
      button.innerHTML = 'Stake LP';
      button.disabled = false;
    }
  }
  
  async function withdrawTx(amt, button) {
    if (amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return false;
    }
    
    try {
      // Show loading state
      const originalText = button.textContent;
      button.innerHTML = `
        <div class="flex items-center justify-center gap-2">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-t-2 border-white"></div>
          <span>Withdrawing...</span>
        </div>
      `;
      button.disabled = true;
      
      // Execute transaction
      await XianWalletUtils.sendTransaction(
        meta.farm,
        'withdraw',
        {
          amount: amt
        }
      );
      
      // Success
      showToast(`Successfully withdrawn ${fmt(amt)} LP tokens`, 'success');
      return true;
    } catch (error) {
      console.error('Withdrawal failed:', error);
      showToast('Failed to withdraw LP tokens. Please try again.', 'error');
      return false;
    } finally {
      // Reset button
      button.innerHTML = 'Withdraw LP';
      button.disabled = false;
    }
  }
  
  async function harvestTx(amt, button) {
    if (amt <= 0) {
      showToast('No rewards to harvest', 'warning');
      return false;
    }
    
    try {
      // Show loading state
      const originalText = button.textContent;
      button.innerHTML = `
        <div class="flex items-center justify-center gap-2">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-t-2 border-white"></div>
          <span>Harvesting...</span>
        </div>
      `;
      button.disabled = true;
      
      // Execute transaction
      await XianWalletUtils.sendTransaction(
        meta.farm,
        'withdrawRewards',
        {
          amount: amt
        }
      );
      
      // Success
      showToast(`Successfully harvested ${fmt(amt)} ${meta.reward} tokens`, 'success');
      return true;
    } catch (error) {
      console.error('Harvest failed:', error);
      showToast('Failed to harvest rewards. Please try again.', 'error');
      return false;
    } finally {
      // Reset button
      button.innerHTML = 'Harvest Rewards';
      button.disabled = false;
    }
  }
  
  // Stake button handler
  el.querySelector('.stake').onclick = async () => {
    const amt = parseFloat($amount.value);
    const button = el.querySelector('.stake');
    
    if (!amt) {
      showToast('Please enter an amount to stake', 'warning');
      return;
    }
    
    const success = await stakeTx(amt, button);
    if (success) {
      $amount.value = '';
      await refresh();
    }
  };
  
  // Unstake button handler
  el.querySelector('.unstake').onclick = async () => {
    const amt = parseFloat($amount.value);
    const button = el.querySelector('.unstake');
    
    if (!amt) {
      showToast('Please enter an amount to withdraw', 'warning');
      return;
    }
    
    const success = await withdrawTx(amt, button);
    if (success) {
      $amount.value = '';
      await refresh();
    }
  };
  
  // Harvest button handler
  $harvest.onclick = async () => {
    const amt = parseFloat($earned.textContent);
    
    if (!amt || amt <= 0) {
      showToast('No rewards available to harvest', 'warning');
      return;
    }
    
    const success = await harvestTx(amt, $harvest);
    if (success) {
      await refresh();
    }
  };

  return { el, refresh };
}


  /* Show loading state */
  function showLoading() {
    isLoading = true;
    if (LOADING) LOADING.style.display = 'flex';
  }

  /* Hide loading state */
  function hideLoading() {
    isLoading = false;
    if (LOADING) LOADING.style.display = 'none';
  }

  /* Show toast notification */
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `animate-scale-in px-4 py-3 rounded-lg shadow-lg max-w-xs text-sm font-medium ${
      type === 'success' ? 'bg-emerald-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'warning' ? 'bg-amber-500 text-white' :
      'bg-brand-cyan text-brand-base'
    }`;
    
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        ${type === 'success' ? 
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>' :
        type === 'error' ? 
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>' :
        type === 'warning' ? 
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>' :
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>'
        }
        <span>${message}</span>
      </div>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ---------- boot -------------------------------------------------- */
  async function init() {
    showLoading();
    
    try {
      const txt = await fetch(FARMS_TXT).then(r => r.text());
      
      // Clear any existing farms
      GRID.innerHTML = '';
      farms.length = 0;
      
      const farmLines = txt.trim().split('\n');
      
      if (farmLines.length === 0 || (farmLines.length === 1 && !farmLines[0])) {
        // No farms found
        const emptyState = document.createElement('div');
        emptyState.className = 'col-span-full flex flex-col items-center justify-center py-12 text-center';
        emptyState.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 class="text-lg font-medium text-gray-300 mb-2">No Farms Available</h3>
          <p class="text-sm text-gray-400 max-w-md">There are currently no active farming opportunities. Check back later for new yield farming options.</p>
        `;
        GRID.appendChild(emptyState);
      } else {
        // Process farms
        farmLines.forEach(line => {
          if (!line) return;
          const [pairIdx, title, reward, farm, stake, contract0, contract1] = line.split(';');
          const { el, refresh } = createCard({pairIdx, title, reward, farm, stake, contract0, contract1});
          GRID.appendChild(el);
          farms.push({ refresh });
        });
        
        // Refresh all farms
        await refreshAllFarms();
      }
    } catch (error) {
      console.error('Failed to initialize farms:', error);
      showToast('Failed to load farms. Please try again later.', 'error');
      
      // Show error state
      const errorState = document.createElement('div');
      errorState.className = 'col-span-full flex flex-col items-center justify-center py-12 text-center';
      errorState.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-300 mb-2">Failed to Load Farms</h3>
        <p class="text-sm text-gray-400 max-w-md">We encountered an error while loading the farms. Please try refreshing the page or try again later.</p>
        <button id="retryFarmsBtn" class="mt-4 px-4 py-2 bg-brand-cyan text-brand-base rounded-md text-sm font-medium hover:bg-brand-cyan/90 transition-colors">
          Retry
        </button>
      `;
      GRID.appendChild(errorState);
      
      // Add retry button handler
      document.getElementById('retryFarmsBtn')?.addEventListener('click', init);
    } finally {
      hideLoading();
    }
  }

  /* Refresh all farms with loading state */
  async function refreshAllFarms() {
    if (isLoading) return; // Prevent multiple refreshes
    
    showLoading();
    
    try {
      // Use Promise.all to refresh all farms in parallel
      await Promise.all(farms.map(f => f.refresh().catch(err => {
        console.warn('Failed to refresh a farm:', err);
        // Continue with other farms even if one fails
      })));
      
      showToast('Farms refreshed successfully', 'success');
    } catch (error) {
      console.error('Failed to refresh farms:', error);
      showToast('Failed to refresh farms', 'error');
    } finally {
      hideLoading();
    }
  }

  // Export refreshFarms for global access
  window.refreshFarms = refreshAllFarms;

  // Add event listener to refresh button
  document.getElementById('refreshFarmsBtn')?.addEventListener('click', refreshAllFarms);

  /* kick-off when DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
