/* assets/staking.js  ────────────────────────────────────────────────────
 * Plain old script (no import / export). Builds staking cards into
 * #stakingView, refreshes them from RPC, and listens for wallet connect.
 */

(() => {
  const GRID = document.querySelector('#stakingView .staking-grid'); // selector for staking grid
  const STAKING_CONTRACT = "con_staking_v1";                                  // staking contract from app.js
  const CHAIN_RPC = "https://node.xian.org";                            // RPC endpoint
  let refreshTimer = null;                                          // auto-refresh timer
  
  /* ---------- card constructor ------------------------------------- */
  function createCard(meta) {
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
          <dd class="lock-period text-white/80 font-medium">7 days</dd>
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

          <div class="grid grid-cols-2 gap-3 mt-4">
            <button class="stake staking-btn py-2 rounded-md font-medium disabled transition-colors duration-150 bg-brand-cyan text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Stake
            </button>
            <button class="unstake staking-btn py-2 rounded-md font-medium disabled transition-colors duration-150 text-gray-900 bg-brand-magenta">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14"/>
              </svg>
              Withdraw
            </button>
          </div>

          <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg mt-6">
            <div>
              <p class="staking-info-label">Claimable Rewards</p>
              <p class="earned staking-info-value">0 ${meta.token}</p>
            </div>
            <button class="harvest staking-btn staking-btn-harvest px-4" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 7V3m8 4V3M3 21h18M3 10h18M3 7h18M3 14h18M3 18h18"/>
              </svg>
              Claim
            </button>
          </div>
          
          <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg mt-2">
            <div>
              <p class="staking-info-label">Lock Expires</p>
              <p class="unlock staking-info-value">—</p>
            </div>
          </div>
        </div>
      </details>
    `;

    /* cached selectors */
    const $ = (sel) => el.querySelector(sel);
    const $apr = $('.apr');
    const $totalStaked = $('.total-staked');
    const $stake = $('.mystake');
    const $bal = $('.bal');
    const $earned = $('.earned');
    const $unlock = $('.unlock');
    const $amount = $('.amount');
    const $harvest = $('.harvest');

    /* helper */
    const fmt = (x, dp = 2) =>
      Number(x).toLocaleString("en-US", { maximumFractionDigits: dp });

    /* ---------------- refresh from RPC ---------------- */
    window.refreshStaking = async () => {
      try {
        // Simulate the getInfo call to the staking contract
        const farmInfo = await simulate(STAKING_CONTRACT, "getInfo", { who: userAddress || "" });
        
        // Parse the response
        const data = farmInfo.split(",").map(item => item.trim());
        
        if (!data || data.length < 6) {
          console.error("Invalid staking info format:", data);
          return;
        }
        
        let beg, end, rps, total, stakeTok, rewardToken, staked, rewardsAvailable;
        
        if (data.length == 6) {
          [beg, end, rps, total, stakeTok, rewardToken] = data;
        } else if (data.length == 8) {
          [beg, end, rps, total, stakeTok, rewardToken, staked, rewardsAvailable] = data;
        }
        
        // Update APR
        const APR_PCT = 10; // constant from app.js
        $apr.textContent = APR_PCT.toFixed(2) + '%';
        
        // Update total staked
        let totalFormatted = typeof total === "number" ? total : parseFloat(total).toFixed(4);
        $totalStaked.textContent = totalFormatted;
        
        if (userAddress) {
          // Get user rewards
          const pendingRewards = await getRewards(userAddress);
          
          // Update user stake
          let stakedFormatted = typeof staked === "number" ? staked : parseFloat(staked).toFixed(8);
          $stake.textContent = stakedFormatted + " " + meta.token;
          
          // Update user rewards
          let rewardsFormatted = typeof pendingRewards === "number" ? pendingRewards : parseFloat(pendingRewards).toFixed(8);
          if (rewardsFormatted < 0.00000001) {
            rewardsFormatted = "0.00000000"; // avoid showing too small numbers
          }
          if (rewardsFormatted === "NaN") {
            rewardsFormatted = "0.00000000"; // handle NaN case
          }
          $earned.textContent = rewardsFormatted + " " + meta.token;
          $harvest.disabled = !(pendingRewards > 0);
          
          // Update wallet balance
          const bal = await fetchWalletBalance(userAddress);
          $bal.textContent = parseFloat(bal).toFixed(8) + " " + meta.token;
          
          // Update unlock time
          let depositTime = await getDepositTime(userAddress);
          if (depositTime) {
            try {
              // depositTime is array [2025, 6, 27, 18, 45, 33, 0]
              // convert to Date object, the source is UTC
              depositTime = new Date(depositTime[0], depositTime[1] - 1, depositTime[2], depositTime[3], depositTime[4], depositTime[5]);
              // This is a UTC date, we need to convert it to local time
              depositTime = new Date(depositTime.getTime() - depositTime.getTimezoneOffset() * 60000); // adjust for local timezone
              
              const unlockDate = new Date(depositTime.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
              $unlock.textContent = unlockDate.toLocaleDateString() + " " + unlockDate.toLocaleTimeString();
            } catch (e) {
              console.error("Invalid deposit time format:", depositTime);
              $unlock.textContent = "—";
            }
          } else {
            $unlock.textContent = "—"; // no deposit yet
          }
        }
      } catch (error) {
        console.error("Error refreshing staking data:", error);
      }
    }

    /* ---------------- button handlers ----------------- */
    async function stakeTx(amt) {
      if (amt <= 0) return toast('Enter amount', 'error');
      
      await runTx({
        btn: $('.stake'),
        labelIdle: 'Stake',
        txs: [
          { c: 'currency', f: 'approve', k: { to: STAKING_CONTRACT, amount: amt } },
          { c: STAKING_CONTRACT, f: 'deposit', k: { amount: amt } }
        ],
        onSuccess: async () => {
          toast('Deposit submitted');
          $amount.value = '';
          await window.refreshStaking();
        }
      });
    }
    
    async function withdrawTx(amt) {
      if (amt <= 0) return toast('Enter amount', 'error');
      
      await runTx({
        btn: $('.unstake'),
        labelIdle: 'Withdraw',
        txs: [{ c: STAKING_CONTRACT, f: 'withdraw', k: { amount: amt } }],
        onSuccess: async () => {
          toast('Withdraw submitted');
          $amount.value = '';
          await window.refreshStaking();
        }
      });
    }
    
    async function harvestTx() {
      const rewards = parseFloat($earned.textContent);
      if (rewards <= 0) return toast('Nothing to harvest', 'error');
      
      await runTx({
        btn: $('.harvest'),
        labelIdle: 'Claim',
        txs: [{ c: STAKING_CONTRACT, f: 'withdrawRewards', k: { amount: rewards } }],
        onSuccess: async () => {
          toast('Claim TX submitted');
          await window.refreshStaking();
        }
      });
    }
    
    $('.stake').onclick = async () => {
      const amt = parseFloat($amount.value);
      if (!amt) return toast('Enter amount', 'error');
      await stakeTx(amt);
    };
    
    $('.unstake').onclick = async () => {
      const amt = parseFloat($amount.value);
      if (!amt) return toast('Enter amount', 'error');
      await withdrawTx(amt);
    };
    
    $harvest.onclick = async () => {
      await harvestTx();
    };

    return { el };
  }

  /* ---------- helper functions ------------------------------------- */
  /* ——— toast helper ——— */
  function toast(msg, type = "success") {
    const box = document.createElement("div");
    box.className = `toast text-white px-3 py-2 mb-2 ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    box.innerHTML = msg;
    document.getElementById("toastContainer").appendChild(box);
    setTimeout(() => box.classList.add("show"), 50);
    setTimeout(() => box.classList.remove("show"), 3000);
    setTimeout(() => box.remove(), 3500);
  }

  /* ——— helper to build simulate_tx path ——— */
  const enc = new TextEncoder();
  const toHex = (bytes) => Array.from(bytes).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

  async function simulate(contract, fn, kwargs = {}) {
    const payload = { sender: "", contract, function: fn, kwargs };
    const hex = toHex(enc.encode(JSON.stringify(payload)));
    const res = await fetch(`${CHAIN_RPC}/abci_query?path="/simulate_tx/${hex}"`);
    const json = await res.json();
    return JSON.parse(atob(json.result.response.value)).result;
  }

  async function fetchWalletBalance(addr) {
    const payload = {
      sender: "",          // dry-run
      contract: "currency",
      function: "balance_of",
      kwargs: { address: addr }
    };
    const hex = toHex(enc.encode(JSON.stringify(payload)));
    const r = await fetch(`${CHAIN_RPC}/abci_query?path="/simulate_tx/${hex}"`);
    const val = atob((await r.json()).result.response.value);
    return +JSON.parse(val).result;        // numeric
  }

  async function getDepositTime(addr = "") {
    /* returns deposit time in ISO format */
    const res = await fetch(`${CHAIN_RPC}/abci_query?path="/get/${STAKING_CONTRACT}.deposits:${addr}"`);
    const json = await res.json();
    try {
      if (!json.result.response.value) return null; // no deposit
    } catch (e) {
      console.error("Failed to parse deposit data:", e);
      return null;
    }
    const decoded = JSON.parse(atob(json.result.response.value));
    if (!decoded || !decoded.deposit_time) return null;
    return decoded.deposit_time.__time__;
  }

  async function getRewards(addr = "") {
    /* returns rewards available for withdrawal */
    return await simulate(STAKING_CONTRACT, "getRewards", { address: addr });
  }

  async function runTx({ btn, labelIdle, onSuccess, txs }) {
    /* btn – DOM element or selector string      (optional)
       labelIdle – text to restore after spinner (optional)
       onSuccess – callback executed after ALL tx succeed
       txs – array of { c, f, k } contracts to execute in order   */

    const $btn = btn ? (typeof btn === 'string' ? document.querySelector(btn) : btn) : null;

    // helper for showing / hiding spinner
    const showSpinner = () => {
      if ($btn) { $btn.disabled = true; $btn.innerHTML = `<div class="spinner-border spinner-border-sm"></div>`; }
    };
    const hideSpinner = () => {
      if ($btn) { $btn.disabled = false; $btn.innerHTML = labelIdle; }
    };

    try {
      showSpinner();
      for (const { c, f, k } of txs) {
        const res = await XianWalletUtils.sendTransaction(c, f, k);
        if (res?.errors) { throw new Error(res.errors); }
      }
      await onSuccess?.();                        // final callback
    } catch (err) {
      console.error(err);
      toast(err.message || 'Transaction failed', 'error');
    } finally { hideSpinner(); }
  }

  /* ---------- boot -------------------------------------------------- */
  
  async function init() {
    // Add loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'flex items-center justify-center w-full py-12';
    loadingEl.innerHTML = `
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-cyan"></div>
    `;
    GRID.appendChild(loadingEl);
    
    try {
      // Remove loading indicator
      GRID.removeChild(loadingEl);
      
      // Create staking card
      const stakingData = {
        title: "Xian Staking",
        token: "XIAN",
        contract: STAKING_CONTRACT
      };
      
      const { el } = createCard(stakingData);
      GRID.appendChild(el);
      
      // Store refresh function globally
      window.refreshStaking()
      
      // Set up auto-refresh
      refreshTimer = setInterval(window.refreshStaking, 15000);  // auto refresh every 15 s
    } catch (error) {
      console.error('Error loading staking:', error);
      // Show error message
      GRID.innerHTML = `
        <div class="col-span-full text-center py-12">
          <p class="text-red-400">Failed to load staking. Please try again later.</p>
        </div>
      `;
    }
  }

  

  /* kick-off when DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();