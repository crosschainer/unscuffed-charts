/* assets/staking.js  ────────────────────────────────────────────────────
 * ES6 module for staking functionality. Builds staking cards into
 * #stakingView, refreshes them from RPC, and listens for wallet connect.
 */

import { CONTRACTS, API_CONFIG, INTERVALS, STAKING_CONFIG } from './constants.js';
import { ErrorHandler } from './error-handler.js';
import { createSkeleton, debounce } from './dom-utils.js';

class StakingManager {
  constructor() {
    this.grid = document.querySelector('#stakingView .staking-grid');
    this.refreshTimer = null;
    this.errorHandler = new ErrorHandler('StakingManager');
    this.debouncedRefresh = debounce(() => this.refresh(), 1000);
  }

  /* ---------- card constructor ------------------------------------- */
  createCard(meta) {
    const el = document.createElement('article');
    el.className = 'staking-card';

    /* template */
    el.innerHTML = /*html*/`
      <!-- header -->
      <div class="staking-card-header">
        <div class="flex items-center gap-3">
          <div class="flex-1">
            <h3 class="staking-title">${meta.title}</h3>
            <p class="staking-token">Token: ${meta.token}</p>
          </div>
        </div>
      </div>

      <!-- quick stats -->
      <dl class="staking-stats flex flex-col gap-4 text-sm">
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Annual Percentage Rate</dt>
          <dd class="apr staking-apr">—</dd>
        </div>
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Total Staked</dt>
          <dd class="total-staked staking-total">—</dd>
        </div>
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Lock Period</dt>
          <dd class="lock-period text-white/80 font-medium">${STAKING_CONFIG.LOCK_PERIOD_DAYS} days</dd>
        </div>
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Reward Token</dt>
          <dd class="reward text-white/80 font-medium">${meta.token}</dd>
        </div>
      </dl>

      <!-- interaction -->
      <details class="staking-manage group">
        <summary class="flex items-center justify-between">
          <span>Manage Your Position</span>
          <svg class="w-4 h-4 shrink-0 transition-transform group-open:-rotate-180"
               viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </summary>

        <div class="staking-manage-body space-y-4">
          <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg">
            <p class="staking-info-label">Your Stake</p>
            <p class="mystake staking-info-value">— ${meta.token}</p>
          </div>
          
          <div class="flex justify-between">
            <p class="staking-info-label">Wallet Balance</p>
            <p class="bal staking-info-value">— ${meta.token}</p>
          </div>

          <div class="relative mt-2">
            <input type="number" min="0" step="any" inputmode="decimal" placeholder="Enter amount to stake or withdraw"
                   class="amount staking-input">
          </div>

          <div class="flex justify-between items-center">
            <p class="staking-info-label">Claimable Rewards</p>
            <p class="rewards staking-info-value">— ${meta.token}</p>
          </div>

          <div class="flex justify-between items-center">
            <p class="staking-info-label">Lock Expires</p>
            <p class="expiry staking-info-value">—</p>
          </div>

          <div class="staking-actions flex gap-2">
            <button class="stake-btn staking-btn staking-btn-primary">Stake</button>
            <button class="withdraw-btn staking-btn staking-btn-secondary">Withdraw</button>
            <button class="harvest-btn staking-btn staking-btn-accent">Harvest</button>
          </div>
        </div>
      </details>
    `;

    return el;
  }

  /* ---------- RPC helpers ------------------------------------------ */
  async simulate(contract, method, sender = '', kwargs = {}) {
    try {
      const response = await fetch(`${API_CONFIG.RPC_URL}/simulate_tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract,
          method,
          sender,
          kwargs
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result || data;
    } catch (error) {
      this.errorHandler.handleError(error, 'simulate', { contract, method });
      throw error;
    }
  }

  async fetchWalletBalance(address) {
    try {
      return await this.simulate('currency', 'balance_of', '', { account: address });
    } catch (error) {
      this.errorHandler.handleError(error, 'fetchWalletBalance', { address });
      return 0;
    }
  }

  async getDepositTime(address) {
    try {
      const response = await fetch(`${API_CONFIG.RPC_URL}/abci_query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/get/${CONTRACTS.STAKING}.deposit_time:${address}`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result?.response?.value ? 
        JSON.parse(atob(data.result.response.value)) : null;
    } catch (error) {
      this.errorHandler.handleError(error, 'getDepositTime', { address });
      return null;
    }
  }

  async getRewards(address) {
    try {
      return await this.simulate(CONTRACTS.STAKING, 'get_rewards', '', { account: address });
    } catch (error) {
      this.errorHandler.handleError(error, 'getRewards', { address });
      return 0;
    }
  }

  /* ---------- transaction helpers ---------------------------------- */
  async runTx(description, txFunction) {
    try {
      this.showToast(`${description}...`, 'info');
      const result = await txFunction();
      this.showToast(`${description} successful!`, 'success');
      this.debouncedRefresh();
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, 'runTx', { description });
      this.showToast(`${description} failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async stakeTx(amount) {
    return this.runTx('Staking', async () => {
      // First approve the amount
      await window.XianWalletUtils.sendTransaction(
        'currency', 'approve', 
        { to: CONTRACTS.STAKING, amount: parseFloat(amount) }, 
        50000
      );

      // Then stake
      return await window.XianWalletUtils.sendTransaction(
        CONTRACTS.STAKING, 'stake', 
        { amount: parseFloat(amount) }, 
        50000
      );
    });
  }

  async withdrawTx(amount) {
    return this.runTx('Withdrawing', async () => {
      return await window.XianWalletUtils.sendTransaction(
        CONTRACTS.STAKING, 'withdraw', 
        { amount: parseFloat(amount) }, 
        50000
      );
    });
  }

  async harvestTx() {
    return this.runTx('Harvesting rewards', async () => {
      return await window.XianWalletUtils.sendTransaction(
        CONTRACTS.STAKING, 'harvest', 
        {}, 
        50000
      );
    });
  }

  /* ---------- UI helpers ------------------------------------------- */
  showToast(message, type = 'info', duration = 3000) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  formatNumber(value) {
    if (!value || isNaN(value)) return '—';
    const num = parseFloat(value);
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(1) + 'M';
  }

  formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return '—';
    }
  }

  /* ---------- main refresh logic ----------------------------------- */
  async refresh() {
    if (!this.grid) {
      this.errorHandler.handleError(new Error('Staking grid not found'), 'refresh');
      return;
    }

    try {
      // Show loading state
      this.grid.innerHTML = createSkeleton('staking-card', 1);

      // Get wallet address
      const userAddress = window.userAddress;
      if (!userAddress) {
        this.renderCard({
          title: STAKING_CONFIG.TITLE,
          token: STAKING_CONFIG.TOKEN,
          apr: '—',
          totalStaked: '—',
          userStake: '—',
          walletBalance: '—',
          rewards: '—',
          lockExpiry: '—'
        });
        return;
      }

      // Fetch all data concurrently
      const [
        totalStaked,
        userStake,
        walletBalance,
        rewards,
        depositTime
      ] = await Promise.all([
        this.simulate(CONTRACTS.STAKING, 'get_total_staked'),
        this.simulate(CONTRACTS.STAKING, 'get_stake', '', { account: userAddress }),
        this.fetchWalletBalance(userAddress),
        this.getRewards(userAddress),
        this.getDepositTime(userAddress)
      ]);

      // Calculate APR (simplified - you may want to implement proper APR calculation)
      const apr = totalStaked > 0 ? '12.5%' : '—'; // Placeholder

      // Calculate lock expiry
      let lockExpiry = '—';
      if (depositTime && userStake > 0) {
        const expiryTime = new Date(depositTime).getTime() + STAKING_CONFIG.LOCK_PERIOD_MS;
        lockExpiry = this.formatDate(expiryTime);
      }

      this.renderCard({
        title: STAKING_CONFIG.TITLE,
        token: STAKING_CONFIG.TOKEN,
        apr,
        totalStaked: this.formatNumber(totalStaked),
        userStake: this.formatNumber(userStake),
        walletBalance: this.formatNumber(walletBalance),
        rewards: this.formatNumber(rewards),
        lockExpiry
      });

    } catch (error) {
      this.errorHandler.handleError(error, 'refresh');
      this.showToast('Failed to load staking data', 'error');
    }
  }

  renderCard(data) {
    const card = this.createCard({
      title: data.title,
      token: data.token
    });

    // Update data fields
    card.querySelector('.apr').textContent = data.apr;
    card.querySelector('.total-staked').textContent = `${data.totalStaked} ${data.token}`;
    card.querySelector('.mystake').textContent = `${data.userStake} ${data.token}`;
    card.querySelector('.bal').textContent = `${data.walletBalance} ${data.token}`;
    card.querySelector('.rewards').textContent = `${data.rewards} ${data.token}`;
    card.querySelector('.expiry').textContent = data.lockExpiry;

    // Wire up event handlers
    this.wireCardEvents(card);

    // Replace grid content
    this.grid.innerHTML = '';
    this.grid.appendChild(card);
  }

  wireCardEvents(card) {
    const amountInput = card.querySelector('.amount');
    const stakeBtn = card.querySelector('.stake-btn');
    const withdrawBtn = card.querySelector('.withdraw-btn');
    const harvestBtn = card.querySelector('.harvest-btn');

    stakeBtn?.addEventListener('click', async () => {
      const amount = amountInput.value;
      if (!amount || parseFloat(amount) <= 0) {
        this.showToast('Please enter a valid amount', 'error');
        return;
      }
      try {
        await this.stakeTx(amount);
        amountInput.value = '';
      } catch (error) {
        // Error already handled in stakeTx
      }
    });

    withdrawBtn?.addEventListener('click', async () => {
      const amount = amountInput.value;
      if (!amount || parseFloat(amount) <= 0) {
        this.showToast('Please enter a valid amount', 'error');
        return;
      }
      try {
        await this.withdrawTx(amount);
        amountInput.value = '';
      } catch (error) {
        // Error already handled in withdrawTx
      }
    });

    harvestBtn?.addEventListener('click', async () => {
      try {
        await this.harvestTx();
      } catch (error) {
        // Error already handled in harvestTx
      }
    });
  }

  /* ---------- lifecycle -------------------------------------------- */
  init() {
    try {
      if (!this.grid) {
        throw new Error('Staking grid element not found');
      }

      // Initial refresh
      this.refresh();

      // Set up auto-refresh
      this.refreshTimer = setInterval(() => {
        this.refresh();
      }, INTERVALS.STAKING_REFRESH);

      this.errorHandler.log('StakingManager initialized successfully', 'info');
    } catch (error) {
      this.errorHandler.handleError(error, 'init');
    }
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Create and export singleton instance
const stakingManager = new StakingManager();

// Global refresh function for compatibility
window.refreshStaking = () => stakingManager.refresh();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => stakingManager.init());
} else {
  stakingManager.init();
}

export { stakingManager as default, StakingManager };