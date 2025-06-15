/* Generic helpers ---------------------------------------------------------*/
export async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.json();
}

// ─── throttle_N_parallel_requests ──────────────────────────────
const inFlight = new Set();
export async function throttledFetchJSON(url, opts, limit = 12) {
    while (inFlight.size >= limit) await Promise.race(inFlight);
    const p = fetchJSON(url, opts).finally(() => inFlight.delete(p));
    inFlight.add(p);
    return p;
}

export function chunk(arr, size = 16) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size),
    );
}

export function timeAgo(iso) {
    if (!iso.endsWith('Z') && !iso.includes('+')) iso += 'Z';     // assume UTC
    const then = new Date(iso).getTime();
    const mins = Math.floor((Date.now() - then) / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} h ago`;
    return `${Math.floor(hrs / 24)} d ago`;
}
export function binarySearch(arr, key, sel = x => x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sel(arr[mid]) < key) hi = mid; else lo = mid + 1; // DESC
    }
    return lo;
}
export function getPairFromHash() {
    const m = location.hash.match(/pair=(\d+)/);
    return m ? m[1] : null;               // returns "42" or null
}

export function setPairHash(id) {
    history.replaceState(null, '', `#pair=${id}`);
}
export function formatPrice(value) {
    const num = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(num)) return '—';

    const abs = Math.abs(num);
    let dp;                          // decimals to print

    if (abs >= 1) dp = 2;   //  12.34
    else if (abs >= 0.1) dp = 4;   //   0.1234
    else if (abs >= 0.01) dp = 6;   //   0.012345
    else if (abs >= 0.001) dp = 8;   //   0.00123456
    else dp = 10;  //   0.0000123456

    return num.toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
    });
}