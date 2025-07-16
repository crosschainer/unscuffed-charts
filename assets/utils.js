export async function fetchJSON(url, opts = {}, retries = 10, backoff = 200, timeout = 5000) {
  let lastErr;

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...opts,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`${url} → HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;

      const isAbort = err.name === 'AbortError';
      const isRetryable = isAbort || !err.response || (err.message && err.message.includes('HTTP 5'));

      if (i === retries || !isRetryable) break;

      console.warn(`Retry ${i + 1} for ${url}:`, err.message);
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2; // exponential backoff
    }
  }

  throw lastErr;
}


// Throttle parallel requests to prevent overwhelming the server
const inFlight = new Set();

export async function throttledFetchJSON(url, opts, limit = 12) {
  while (inFlight.size >= limit) {
    await Promise.race(inFlight);
  }
  
  const promise = fetchJSON(url, opts).finally(() => inFlight.delete(promise));
  inFlight.add(promise);
  return promise;
}

export function chunk(arr, size = 16) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export function timeAgo(iso) {
  if (!iso.endsWith('Z') && !iso.includes('+')) {
    iso += 'Z'; // assume UTC
  }
  
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60_000);
  
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} m ago`;
  
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  
  return `${Math.floor(hrs / 24)} d ago`;
}
export function binarySearch(arr, key, selector = x => x) {
  let lo = 0;
  let hi = arr.length;
  
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (selector(arr[mid]) < key) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  
  return lo;
}
export function getPairFromHash() {
  const match = location.hash.match(/pair=(\d+)/);
  return match ? match[1] : null;
}

export function isFarmsHash() {
  return location.hash === '#farms';
}

export function setPairHash(id) {
  history.replaceState(null, '', `#pair=${id}`);
}
export function formatPrice(value) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';

  const abs = Math.abs(num);
  let decimals;

  if (abs >= 1) decimals = 2;        // 12.34
  else if (abs >= 0.1) decimals = 4; // 0.1234
  else if (abs >= 0.01) decimals = 6; // 0.012345
  else if (abs >= 0.001) decimals = 8; // 0.00123456
  else decimals = 10;                 // 0.0000123456

  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}