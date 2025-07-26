/* DOM references & skeletons ---------------------------------------------*/

import { UI_CONFIG, ASSETS } from './constants.js';
import { createSkeleton } from './dom-utils.js';
export const els = {
  // Sidebar elements
  pairsScroller: document.getElementById('pairsScroller'),
  rowHost: document.getElementById('rowHost'),
  topPad: document.getElementById('topPad'),
  bottomPad: document.getElementById('bottomPad'),
  
  // Main content elements
  pairName: document.getElementById('pairName'),
  pairLogo: document.getElementById('pairLogo'),
  price: document.getElementById('price'),
  delta: document.getElementById('delta'),
  liquidity: document.getElementById('liquidity'),
  volume: document.getElementById('volume'),
  tradesList: document.getElementById('tradesList'),
  chartWrap: document.getElementById('chartContainer'),
  
  // Token info elements
  infoTokenName: document.getElementById('tiName'),
  infoTokenSymbol: document.getElementById('tiSymbol'),
  infoTokenSupply: document.getElementById('tiSupply'),
  infoTokenOperator: document.getElementById('tiOperator'),
  infoTokenExplorer: document.getElementById('tiExplorer'),
  infoTokenMarketCap: document.getElementById('tiMarketCap'),

  // Mobile copies
  priceM: document.getElementById('priceM'),
  deltaM: document.getElementById('deltaM'),
  liquidityM: document.getElementById('liquidityM'),
  volumeM: document.getElementById('volumeM'),
};

export function showSidebarSkeleton(count = UI_CONFIG.SIDEBAR_SKELETON_COUNT) {
  els.rowHost.innerHTML = '';
  
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.className = 'flex flex-col items-start w-full px-4 py-2 text-left hover:bg-white/5 active:bg-white/10 transition';
    btn.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span class="flex items-center gap-2">
          <img src="${ASSETS.PLACEHOLDER_IMAGE}" width="20" height="20" 
               onerror="this.onerror=null;this.src='${ASSETS.PLACEHOLDER_IMAGE}';" 
               alt="Loading...">
          <span class="bg-gray-700 rounded animate-pulse inline-block w-24 h-4"></span>
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
  // Main stats
  els.price.innerHTML = createSkeleton('w-12', 'h-4');
  els.delta.innerHTML = createSkeleton('w-12', 'h-4');
  els.liquidity.innerHTML = createSkeleton('w-24', 'h-4');
  els.volume.innerHTML = createSkeleton('w-24', 'h-4');
  els.pairName.innerHTML = createSkeleton('w-24', 'h-6');
  
  // Mobile stats
  els.priceM.innerHTML = createSkeleton('w-12', 'h-4');
  els.deltaM.innerHTML = createSkeleton('w-12', 'h-4');
  els.liquidityM.innerHTML = createSkeleton('w-24', 'h-4');
  els.volumeM.innerHTML = createSkeleton('w-24', 'h-4');
  
  // Logo and chart
  els.pairLogo.src = ASSETS.PLACEHOLDER_IMAGE;
  els.chartWrap.innerHTML = '<div class="w-full h-full bg-gray-700 rounded animate-pulse"></div>';

  // Trades list skeleton
  els.tradesList.innerHTML = '';
  Array.from({ length: UI_CONFIG.TRADES_SKELETON_COUNT }).forEach(() => {
    const tr = document.createElement('tr');
    tr.className = 'odd:bg-white/5';
    tr.innerHTML = `
      <td class="px-4 py-2">${createSkeleton('w-10', 'h-4')}</td>
      <td class="px-4 py-2">${createSkeleton('w-16', 'h-4')}</td>
      <td class="px-4 py-2">${createSkeleton('w-14', 'h-4')}</td>
      <td class="px-4 py-2">${createSkeleton('w-12', 'h-4')}</td>`;
    els.tradesList.appendChild(tr);
  });

  // Token info skeleton
  els.infoTokenName.innerHTML = createSkeleton('w-12', 'h-4', true);
  els.infoTokenSymbol.innerHTML = createSkeleton('w-12', 'h-4', true);
  els.infoTokenSupply.innerHTML = createSkeleton('w-24', 'h-4', true);
  els.infoTokenOperator.innerHTML = createSkeleton('w-24', 'h-4', true);
  els.infoTokenExplorer.innerHTML = createSkeleton('w-24', 'h-4', true);
  els.infoTokenMarketCap.innerHTML = createSkeleton('w-24', 'h-4', true);
}
