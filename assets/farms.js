/* assets/farms.js  ────────────────────────────────────────────────────
 * Plain old script (no import / export).  Builds farm cards into
 * #farmsView, refreshes them from RPC, and listens for wallet connect.
 */

(() => {
  const GRID = document.querySelector('#farmsView .farms-grid'); // updated selector
  const FARMS_TXT = 'farms.txt';                                // 1 line / farm
  const farms = [];                                             // live instances

  /* ---------- card constructor ------------------------------------- */
  /* ---------- card constructor ------------------------------------- */
function createCard(meta) {
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
        <dt class="text-gray-400 font-medium">Program Ends</dt>
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
          <p class="farm-info-label">Wallet Balance</p>
          <p class="bal farm-info-value">— LP</p>
        </div>

        <div class="relative mt-2">
          <input type="number" min="0" step="any" inputmode="decimal" placeholder="Enter amount to stake or withdraw"
                 class="amount farm-input">
        </div>

        <div class="grid grid-cols-2 gap-3 mt-4">
          <button class="stake farm-btn  py-2 rounded-md font-medium disabled transition-colors duration-150 bg-brand-cyan text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Stake LP
          </button>
          <button class="unstake farm-btn  py-2 rounded-md font-medium disabled transition-colors duration-150 text-gray-900 bg-brand-magenta">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"/>
            </svg>
            Withdraw LP
          </button>
        </div>

        <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg mt-6">
          <div>
            <p class="farm-info-label">Harvestable Rewards</p>
            <p class="earned farm-info-value">0 ${meta.reward}</p>
          </div>
          <button class="harvest farm-btn farm-btn-harvest px-4" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 7V3m8 4V3M3 21h18M3 10h18M3 7h18M3 14h18M3 18h18"/>
            </svg>
            Harvest
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
    const infoJson = await getFarmsInfo(
      'con_staking_mc1',
      userAddress || '',
      [meta.farm]                // single farm
    );
    const data = JSON.parse(infoJson.replace(/'/g, '"'))[0];
    if (!data) return;
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
        [start, end, rps, totalStk,pairIdx,rewardCon, usrLiq, usrStk, usrRew] = data;
    } else {
        [start, end, rps, totalStk, rewardCon] = data;
    }

    let tvlRaw = await RPCcall(
      'con_staking_mc1',
      'lpvalue_xian',
      userAddress || '',
      { dexpairs: 'con_pairs', pairs: [meta.pairIdx] }
    );
    tvlRaw = Number(JSON.parse(tvlRaw.replace(/'/g, '"'))[0]); // tvlRaw is how much 1 LP is worth

    /* APR */
    if (+totalStk > 0) {
      console.log(rps, totalStk, tvlRaw);
      const apr = (Number(rps) * 31_556_926 / (Number(totalStk) * Number(tvlRaw))) * 100;
      $apr.textContent = fmt(apr) + '%';
    }

    /* Ends date */
    if (end) {
      const d = new Date(`${end}Z`);
      $ends.textContent =
        d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }


    if (userAddress) {
        /* user stake / rewards */
        $stake.textContent = fmt(usrStk, 6) + " LP";
        $earned.textContent = fmt(usrRew, 4) + " " + meta.reward;
        $harvest.disabled = !(usrRew > 0);

        /* wallet balance */
        const bal = await getLiq("con_pairs", meta.pairIdx, userAddress);
        $bal.textContent = fmt(bal, 6) + " LP";
    }
  }

  /* ---------------- button handlers ----------------- */
  async function stakeTx(amt) {
    if (amt <= 0) return toast('Enter amount', 'error');
    await XianWalletUtils.sendTransaction(
      "con_pairs",
      'liqApprove',
      {
        pair: parseInt(meta.pairIdx),
        amount: amt,
        to: meta.farm
      }
    );
    await XianWalletUtils.sendTransaction(
      meta.farm,
      'deposit',
      {
        amount: amt
      }
    );

  }
  async function withdrawTx(amt) {
    await XianWalletUtils.sendTransaction(
      meta.farm,
      'withdraw',
      {
        amount: amt
      }
    );

  }
  async function harvestTx (amt) {
    await XianWalletUtils.sendTransaction(
      meta.farm,
      'withdrawRewards',
      {
        amount: amt
      }
    );
  }
  el.querySelector('.stake'  ).onclick = async () => {
    const amt = parseFloat($amount.value);
    if (!amt) return toast('Enter amount', 'error');
    await stakeTx(amt);  toast('Staked!',    'success'); $amount.value='';
    refresh();
  };
  el.querySelector('.unstake').onclick = async () => {
    const amt = parseFloat($amount.value);
    if (!amt) return toast('Enter amount', 'error');
    await withdrawTx(amt); toast('Withdrawn!', 'success'); $amount.value='';
    refresh();
  };
  $harvest.onclick = async () => {
    const amt = parseFloat($earned.textContent);
    await harvestTx(amt);   toast('Harvested!', 'success');
    refresh();
  };

  return { el, refresh };
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
      const txt = await fetch(FARMS_TXT).then(r => r.text());
      
      // Remove loading indicator
      GRID.removeChild(loadingEl);
      
      // Create farm cards
      txt.trim().split('\n').forEach(line => {
        if (!line) return;
        const [pairIdx, title, reward, farm, stake, contract0, contract1] = line.split(';');
        const { el, refresh } = createCard({pairIdx, title, reward, farm, stake, contract0, contract1});
        GRID.appendChild(el);
        farms.push({ refresh });
      });
      
      // Refresh farm data
      farms.forEach(f => f.refresh());
    } catch (error) {
      console.error('Error loading farms:', error);
      // Show error message
      GRID.innerHTML = `
        <div class="col-span-full text-center py-12">
          <p class="text-red-400">Failed to load farming pools. Please try again later.</p>
        </div>
      `;
    }
  }

  window.refreshFarms = () => {
    farms.forEach(f => f.refresh());
  };

  /* kick-off when DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
