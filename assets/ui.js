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
};

export function showSidebarSkeleton(count = 12) {
    els.rowHost.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const ph = Object.assign(document.createElement('div'), {
            className: 'h-10 bg-gray-700 animate-pulse',
        });
        els.rowHost.appendChild(ph);
    }
}

export function showMainSkeleton() {
    const pulse = '<span class="bg-gray-700 rounded animate-pulse inline-block';
    els.price.innerHTML = `${pulse} w-12 h-4"></span>`;
    els.delta.innerHTML = `${pulse} w-12 h-4"></span>`;
    els.liquidity.innerHTML = `${pulse} w-24 h-4"></span>`;
    els.volume.innerHTML = `${pulse} w-24 h-4"></span>`;
    els.pairName.innerHTML = `${pulse} w-24 h-6"></span>`;
    els.pairLogo.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

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
}
