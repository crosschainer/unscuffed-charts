/* DOM references & skeletons ---------------------------------------------*/
export const els = {
    pairsScroller: document.getElementById('pairsScroller'),
    rowHost: document.getElementById('rowHost'),
    topPad: document.getElementById('topPad'),
    bottomPad: document.getElementById('bottomPad'),
    pairName: document.getElementById('pairName'),
    pairLogo: document.getElementById('pairLogo'),
    price: document.getElementById('price'),
    delta: document.getElementById('delta'),
    liquidity: document.getElementById('liquidity'),
    volume: document.getElementById('volume'),
    tradesList: document.getElementById('tradesList'),
    chartWrap: document.getElementById('chartContainer'),
    infoTokenName: document.getElementById('tiName'),
    infoTokenSymbol: document.getElementById('tiSymbol'),
    infoTokenSupply: document.getElementById('tiSupply'),
    infoTokenOperator: document.getElementById('tiOperator'),
    infoTokenExplorer: document.getElementById('tiExplorer'),
    infoTokenMarketCap: document.getElementById('tiMarketCap'),

    /* ▼ mobile copies ▼ */
    priceM     : document.getElementById('priceM'),
    deltaM     : document.getElementById('deltaM'),
    liquidityM : document.getElementById('liquidityM'),
    volumeM    : document.getElementById('volumeM'),
};

export function showSidebarSkeleton(count = 22) {
    els.rowHost.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const btn = document.createElement('button');
        btn.className = 'flex flex-col items-start w-full px-4 py-2 text-left hover:bg-white/5 active:bg-white/10 transition';
        btn.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span class="flex items-center gap-2">
          <img src="./assets/ph.png" width="20" height="20" onerror="this.onerror=null;this.src='./assets/ph.png';">
          <span class="bg-gray          -700 rounded animate-pulse inline-block w-24 h-4"></span>
        </span>
        <span class="text-xs text-rose-400">
          <span class="bg-gray-700 rounded animate-pulse inline-block w-12 h-4"></span>
        </span>         
        </div>
        <div class="text-xs text-gray-400 mt-1.5">
            <span class="bg-gray-700 rounded animate-pulse inline-block w-16 h-4"></span>

                                </div>`;                                    
                                                    els.rowHost.appendChild(btn);           
    }
}

export function showMainSkeleton() {
    const pulse = '<span class="bg-gray-700 rounded animate-pulse inline-block';
    els.price.innerHTML = `${pulse} w-12 h-4 transform translate-y-1"></span>`;
    els.delta.innerHTML = `${pulse} w-12 h-4 transform translate-y-1"></span>`;
    els.liquidity.innerHTML = `${pulse} w-24 h-4 transform translate-y-1"></span>`;
    els.volume.innerHTML = `${pulse} w-24 h-4 transform translate-y-1"></span>`;
    els.pairName.innerHTML = `${pulse} w-24 h-6 transform translate-y-1"></span>`;
    
    els.priceM.innerHTML = `${pulse} w-12 h-4 transform translate-y-1"></span>`;
    els.deltaM.innerHTML = `${pulse} w-12 h-4 transform translate-y-1"></span>`;
    els.liquidityM.innerHTML = `${pulse} w-24 h-4 transform translate-y-1"></span>`;
    els.volumeM.innerHTML = `${pulse} w-24 h-4 transform translate-y-1"></span>`;
    els.pairLogo.src = './assets/ph.png';

    els.chartWrap.innerHTML = '<div class="w-full h-full bg-gray-700 rounded animate-pulse"></div>';

    els.tradesList.innerHTML = '';
    Array.from({ length: 5 }).forEach(() => {
        const tr = document.createElement('tr');
        tr.className = 'odd:bg-white/5';
        tr.innerHTML = `
      <td class="px-4 py-2">${pulse} w-10 h-4"></td>
      <td class="px-4 py-2">${pulse} w-16 h-4"></td>
      <td class="px-4 py-2">${pulse} w-14 h-4"></td>
      <td class="px-4 py-2">${pulse} w-12 h-4"></td>`;
        els.tradesList.appendChild(tr);
    });

    const pulse2 = '<span class="bg-gray-700 rounded animate-pulse block ';
    els.infoTokenName.innerHTML      = `${pulse2} w-12 h-4"></span>`;
    els.infoTokenSymbol.innerHTML    = `${pulse2} w-12 h-4"></span>`;
    els.infoTokenSupply.innerHTML    =  `${pulse2} w-24 h-4"></span>`;
    els.infoTokenOperator.innerHTML  =  `${pulse2} w-24 h-4"></span>`;
    els.infoTokenExplorer.innerHTML  =  `${pulse2} w-24 h-4"></span>`;
    els.infoTokenMarketCap.innerHTML = `${pulse2} w-24 h-4"></span>`;
}
