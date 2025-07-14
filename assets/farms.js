/* assets/farms.js  ────────────────────────────────────────────────────
 * Plain old script (no import / export).  Builds farm cards into
 * #farmsView, refreshes them from RPC, and listens for wallet connect.
 */

(() => {
  const GRID = document.querySelector('#farmsView .grid'); // already there
  const FARMS_TXT = 'farms.txt';                           // 1 line / farm
  const farms = [];                                        // live instances

  /* ---------- card constructor ------------------------------------- */
  /* ---------- card constructor ------------------------------------- */
function createCard(meta) {
  const el = document.createElement('article');
  el.className =
    'flex flex-col bg-brand-card rounded-lg border border-white/5 ' +
    '';

  /* template */
  el.innerHTML = /*html*/`
    <!-- header -->
    <div class="flex items-center gap-3 p-4 border-b border-white/5">
      <div class="flex-1">
        <h3 class="title font-medium leading-tight">${meta.title}</h3>
        <p class="pair text-xs text-gray-400">Pool #${meta.pairIdx}</p>
      </div>
    </div>

    <!-- quick stats -->
    <dl class="stats flex flex-col gap-3 p-4 text-sm">
      <div class="flex justify-between"><dt class="text-gray-400">APR</dt>
           <dd class="apr font-medium text-brand-cyan">—</dd></div>
      <div class="flex justify-between"><dt class="text-gray-400">Reward</dt>
           <dd class="reward">${meta.reward}</dd></div>
      <div class="flex justify-between"><dt class="text-gray-400">Ends</dt>
           <dd class="ends">—</dd></div>
    </dl>

    <!-- interaction -->
    <details class="mt-auto border-t border-white/5 group">
      <summary
        class="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm
               hover:bg-white/5">
        <span class="font-medium">Manage Position</span>
        <svg class="w-4 h-4 shrink-0 transition-transform group-open:-rotate-180"
             viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </summary>

      <div class="body px-4 pt-4 space-y-4">
        <p class="text-xs text-gray-400 font-medium">
          Your Stake:
            <span class="mystake text-gray-200 font-medium">—</span> LP
        </p>
        <p class="text-xs text-gray-400">
          Balance: <span class="bal text-gray-200 font-medium">—</span> LP
        </p>

        <div class="relative">
          <input  type="number" min="0" step="any" inputmode="decimal" placeholder="0.0"
                 class="amount w-full rounded bg-white/5 px-3 py-2 text-right
                    focus:outline-none focus:ring-2 focus:ring-emerald-500">
        </div>

        <div class="grid grid-cols-3 gap-3">
          <button class="stake  py-2 rounded-md text-sm font-medium
                         bg-brand-cyan text-brand-base hover:bg-brand-cyan/90">
            Stake
          </button>
          <button class="unstake py-2 rounded-md text-sm font-medium
                         bg-white/10 hover:bg-white/20">
            Withdraw
          </button>
          <button class="harvest py-2 rounded-md text-sm font-medium
                         bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled>
            Harvest
          </button>
        </div>

        <p class="text-xs text-gray-400 pb-4">
          Harvestable: <span class="earned text-gray-200 font-medium">0</span> ${meta.reward}
        </p>
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
    Number(x).toLocaleString(undefined, { maximumFractionDigits: dp });

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
        $stake.textContent = fmt(usrStk, 6);
        $earned.textContent = fmt(usrRew, 4);
        $harvest.disabled   = !(usrRew > 0);

        /* wallet balance */
        const bal = await getLiq("con_pairs", meta.pairIdx, userAddress);
        $bal.textContent = fmt(bal, 6);
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
    const txt = await fetch(FARMS_TXT).then(r => r.text());
    txt.trim().split('\n').forEach(line => {
      if (!line) return;
      const [pairIdx, title, reward, farm, stake, contract0, contract1] = line.split(';');
      const { el, refresh } = createCard({pairIdx, title, reward, farm, stake, contract0, contract1});
      GRID.appendChild(el);
      farms.push({ refresh });
    });
    farms.forEach(f => f.refresh());

    
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
