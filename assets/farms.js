/* assets/farms.js  ────────────────────────────────────────────────────
 * ES6 module for farming functionality. Builds farm cards into
 * #farmsView, refreshes them from RPC, and listens for wallet connect.
 */

import { ASSETS, INTERVALS, API_CONFIG } from './constants.js';
import { ErrorHandler } from './error-handler.js';
import { createSkeleton, debounce } from './dom-utils.js';

class FarmsManager {
  constructor() {
    this.grid = document.querySelector('#farmsView .farms-grid');
    this.farms = [];
    this.refreshTimer = null;
    this.errorHandler = new ErrorHandler('FarmsManager');
    this.debouncedRefresh = debounce(() => this.refresh(), 1000);
  }

  /* ---------- card constructor ------------------------------------- */
  createCard(meta) {
    const el = document.createElement('article');
    el.className = 'farm-card';

    /* template */
    el.innerHTML = /*html*/`
      <!-- header -->
      <div class="farm-card-header">
        <div class="flex items-center gap-3">
          <div class="flex-1">
            <h3 class="farm-title">${meta.title}</h3>
            <p class="farm-pair">Pool #${meta.pairIdx}</p>
          </div>
        </div>
      </div>

      <!-- quick stats -->
      <dl class="farm-stats flex flex-col gap-4 text-sm">
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Annual Percentage Rate</dt>
          <dd class="apr farm-apr">—</dd>
        </div>
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Reward Token</dt>
          <dd class="reward farm-reward">${meta.reward}</dd>
        </div>

        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Farm Starts</dt>
          <dd class="starts text-white/80 font-medium">—</dd>
        </div>
        <div class="flex justify-between items-center">
          <dt class="text-gray-400 font-medium">Farm Ends</dt>
          <dd class="ends text-white/80 font-medium">—</dd>
        </div>
      </dl>

      <!-- interaction -->
      <details class="farm-manage group">
        <summary class="flex items-center justify-between">
          <span>Manage Your Position</span>
          <svg class="w-4 h-4 shrink-0 transition-transform group-open:-rotate-180"
               viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </summary>

        <div class="farm-manage-body space-y-4">
          <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg">
            <p class="farm-info-label">Your Stake</p>
            <p class="mystake farm-info-value">— LP</p>
          </div>
          
          <div class="flex justify-between">
            <p class="farm-info-label">Wallet LP</p>
            <p class="bal farm-info-value">— LP</p>
          </div>

          <div class="relative mt-2">
            <input type="number" min="0" step="any" inputmode="decimal" placeholder="Enter LP amount"
                   class="amount farm-input">
          </div>

          <div class="flex justify-between items-center">
            <p class="farm-info-label">Harvestable</p>
            <p class="rewards farm-info-value">— ${meta.reward}</p>
          </div>

          <div class="farm-actions flex gap-2">
            <button class="stake-btn farm-btn farm-btn-primary">Stake</button>
            <button class="unstake-btn farm-btn farm-btn-secondary">Unstake</button>
            <button class="harvest-btn farm-btn farm-btn-accent">Harvest</button>
          </div>

          <div class="farm-liquidity-link">
            <a href="#pair=${meta.pairIdx}" class="text-brand-cyan hover:text-brand-cyan/80 text-sm">
              → Add Liquidity for Pool #${meta.pairIdx}
            </a>
          </div>
        </div>
      </details>
    `;

    return el;
  }

  /* ---------- RPC helpers ------------------------------------------ */
  async fetchFarmsConfig() {
    try {
      const response = await fetch(ASSETS.FARMS_CONFIG);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text.trim().split('\n').filter(line => line.trim());
    } catch (error) {
      this.errorHandler.handleError(error, 'fetchFarmsConfig');
      return [];
    }
  }

  async getFarmsInfo(contract, userAddress, farmsList) {
    try {
      return await window.RPCcall(contract, 'get_farms_info', userAddress, { farms: farmsList });
    } catch (error) {
      this.errorHandler.handleError(error, 'getFarmsInfo', { contract, userAddress });
      return {};
    }
  }

  async getLiq(contract, pairIdx, address) {
    try {
      return await window.getLiq(contract, pairIdx, address);
    } catch (error) {
      this.errorHandler.handleError(error, 'getLiq', { contract, pairIdx, address });
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

  async stakeFarm(farmContract, amount) {
    return this.runTx('Staking to farm', async () => {
      return await window.XianWalletUtils.sendTransaction(
        farmContract, 'stake', 
        { amount: parseFloat(amount) }, 
        50000
      );
    });
  }

  async unstakeFarm(farmContract, amount) {
    return this.runTx('Unstaking from farm', async () => {
      return await window.XianWalletUtils.sendTransaction(
        farmContract, 'unstake', 
        { amount: parseFloat(amount) }, 
        50000
      );
    });
  }

  async harvestFarm(farmContract) {
    return this.runTx('Harvesting farm rewards', async () => {
      return await window.XianWalletUtils.sendTransaction(
        farmContract, 'harvest', 
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
      const date = new Date(timestamp * 1000); // Assuming Unix timestamp
      return date.toLocaleDateString();
    } catch {
      return '—';
    }
  }

  /* ---------- main refresh logic ----------------------------------- */
  async refresh() {
    if (!this.grid) {
      this.errorHandler.handleError(new Error('Farms grid not found'), 'refresh');
      return;
    }

    try {
      // Show loading state
      this.grid.innerHTML = createSkeleton('farm-card', 3);

      // Fetch farms configuration
      const farmsList = await this.fetchFarmsConfig();
      if (!farmsList.length) {
        this.grid.innerHTML = '<p class="text-gray-400 text-center">No farms available</p>';
        return;
      }

      // Parse farm configurations
      this.farms = farmsList.map(line => {
        const parts = line.split(',');
        return {
          contract: parts[0]?.trim(),
          title: parts[1]?.trim() || 'Unknown Farm',
          pairIdx: parseInt(parts[2]?.trim()) || 0,
          reward: parts[3]?.trim() || 'Unknown'
        };
      });

      // Get user address
      const userAddress = window.userAddress;

      // Fetch farm data
      const farmCards = await Promise.all(
        this.farms.map(async (farm) => {
          try {
            // Get farm info and user LP balance concurrently
            const [farmInfo, userLpBalance] = await Promise.all([
              this.getFarmsInfo(farm.contract, userAddress || '', [farm.contract]),
              userAddress ? this.getLiq('con_pairs', farm.pairIdx, userAddress) : Promise.resolve(0)
            ]);

            const info = farmInfo[farm.contract] || {};
            
            return {
              ...farm,
              apr: this.formatNumber(info.apr),
              starts: this.formatDate(info.start_time),
              ends: this.formatDate(info.end_time),
              userStake: this.formatNumber(info.user_stake),
              userLpBalance: this.formatNumber(userLpBalance),
              harvestable: this.formatNumber(info.harvestable)
            };
          } catch (error) {
            this.errorHandler.handleError(error, 'refresh farm', { farm: farm.contract });
            return {
              ...farm,
              apr: '—',
              starts: '—',
              ends: '—',
              userStake: '—',
              userLpBalance: '—',
              harvestable: '—'
            };
          }
        })
      );

      this.renderFarms(farmCards);

    } catch (error) {
      this.errorHandler.handleError(error, 'refresh');
      this.showToast('Failed to load farms data', 'error');
      this.grid.innerHTML = '<p class="text-red-400 text-center">Failed to load farms</p>';
    }
  }

  renderFarms(farmData) {
    this.grid.innerHTML = '';

    farmData.forEach(farm => {
      const card = this.createCard({
        title: farm.title,
        pairIdx: farm.pairIdx,
        reward: farm.reward
      });

      // Update data fields
      card.querySelector('.apr').textContent = `${farm.apr}%`;
      card.querySelector('.starts').textContent = farm.starts;
      card.querySelector('.ends').textContent = farm.ends;
      card.querySelector('.mystake').textContent = `${farm.userStake} LP`;
      card.querySelector('.bal').textContent = `${farm.userLpBalance} LP`;
      card.querySelector('.rewards').textContent = `${farm.harvestable} ${farm.reward}`;

      // Wire up event handlers
      this.wireCardEvents(card, farm);

      this.grid.appendChild(card);
    });
  }

  wireCardEvents(card, farm) {
    const amountInput = card.querySelector('.amount');
    const stakeBtn = card.querySelector('.stake-btn');
    const unstakeBtn = card.querySelector('.unstake-btn');
    const harvestBtn = card.querySelector('.harvest-btn');

    stakeBtn?.addEventListener('click', async () => {
      const amount = amountInput.value;
      if (!amount || parseFloat(amount) <= 0) {
        this.showToast('Please enter a valid amount', 'error');
        return;
      }
      try {
        await this.stakeFarm(farm.contract, amount);
        amountInput.value = '';
      } catch (error) {
        // Error already handled in stakeFarm
      }
    });

    unstakeBtn?.addEventListener('click', async () => {
      const amount = amountInput.value;
      if (!amount || parseFloat(amount) <= 0) {
        this.showToast('Please enter a valid amount', 'error');
        return;
      }
      try {
        await this.unstakeFarm(farm.contract, amount);
        amountInput.value = '';
      } catch (error) {
        // Error already handled in unstakeFarm
      }
    });

    harvestBtn?.addEventListener('click', async () => {
      try {
        await this.harvestFarm(farm.contract);
      } catch (error) {
        // Error already handled in harvestFarm
      }
    });
  }

  /* ---------- lifecycle -------------------------------------------- */
  init() {
    try {
      if (!this.grid) {
        throw new Error('Farms grid element not found');
      }

      // Initial refresh
      this.refresh();

      // Set up auto-refresh
      this.refreshTimer = setInterval(() => {
        this.refresh();
      }, INTERVALS.FARMS_REFRESH);

      this.errorHandler.log('FarmsManager initialized successfully', 'info');
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
const farmsManager = new FarmsManager();

// Global refresh function for compatibility
window.refreshFarms = () => farmsManager.refresh();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => farmsManager.init());
} else {
  farmsManager.init();
}

export { farmsManager as default, FarmsManager };