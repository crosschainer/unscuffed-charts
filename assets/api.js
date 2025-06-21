/* Xian-DEX REST wrappers --------------------------------------------------*/
import { fetchJSON } from './utils.js';

export { fetchJSON };   // ← add this
export { throttledFetchJSON } from './utils.js';  // ← add this

export const API_BASE = 'https://api.snaklytics.com';

const TOKEN_CACHE = {};      // contract → {symbol,name,logo}

export { TOKEN_CACHE };  // ← add this
const _pendingContracts = new Set();
const _pendingResolvers = Object.create(null);
let _batchTimer = null;

export async function fetchTokenMeta(contract) {
  // 1) Immediate cache hit
  if (TOKEN_CACHE[contract]) {
    return TOKEN_CACHE[contract];
  }

  // 2) Otherwise, queue up a promise
  const promise = new Promise((resolve, reject) => {
    (_pendingResolvers[contract] ||= []).push({ resolve, reject });
  });
  _pendingContracts.add(contract);

  // 3) Schedule a single batch request in 10 ms
  if (!_batchTimer) {
    _batchTimer = setTimeout(async () => {
      const toFetch = Array.from(_pendingContracts);
      _pendingContracts.clear();
      _batchTimer = null;

      try {
        // 4) One HTTP call for all pending contracts
        const raw = await fetchJSON(
          `${API_BASE}/tokens/${toFetch.join(',')}`
        );
        const arr = Array.isArray(raw) ? raw : [raw];

        // 5) Normalize, cache, and resolve each
        arr.forEach(item => {
          const key = item.contractName;
          const meta = {
            symbol: item.token_symbol    || key.slice(0,6),
            name:   item.token_name      || item.token_symbol || key,
            logo:   item.token_logo_url  || './ph.png',
          };

          TOKEN_CACHE[key] = meta;
          ;(_pendingResolvers[key] || [])
            .forEach(({ resolve }) => resolve(meta));
          delete _pendingResolvers[key];
        });

        // 6) Reject any that never came back
        toFetch
          .filter(key => !TOKEN_CACHE[key])
          .forEach(key => {
            ;(_pendingResolvers[key] || [])
              .forEach(({ reject }) =>
                reject(new Error(`No metadata returned for ${key}`))
              );
            delete _pendingResolvers[key];
          });
      } catch (err) {
        // 7) On network/parse error, reject everybody
        toFetch.forEach(key => {
          ;(_pendingResolvers[key] || [])
            .forEach(({ reject }) => reject(err));
          delete _pendingResolvers[key];
        });
      }
    }, 10);
  }

  return promise;
}


/* High-level “endpoint” helpers — keep these pure, no DOM inside! */

export const getCurrencyPrice = () => fetchJSON(`${API_BASE}/pairs/1/pricechange24h?token=0`);
export function getPairs({ offset = 0, limit = 100, order = "desc" } = {}) {
  const qs = new URLSearchParams({ offset, limit, order });
  return fetchJSON(`${API_BASE}/pairs?${qs}`);
}
export const getPair = id => fetchJSON(`${API_BASE}/pairs/${id}`);
export const get24hPriceChange = (id, t = 1) => fetchJSON(`${API_BASE}/pairs/${id}/pricechange24h?token=${t}`);
export const get24hVolume = (id, t = 1) => fetchJSON(`${API_BASE}/pairs/${id}/volume24h?token=${t}`);
export const getPairCandles = (
  id,
  { interval = '5m', range = '7d', before, limit,
    after,       //  ← new
    token = 0 } = {}
) => {
  const qs = new URLSearchParams({ interval, range, token });
  if (before) qs.append('before', before);
  if (limit)  qs.append('limit',  limit);
  if (after)  qs.append('after',  after);   // ← new line
  return fetchJSON(`${API_BASE}/pairs/${id}/candles?${qs}`)
         .then(r => Array.isArray(r) ? { candles: r, page: {} } : r);
};

export const getPairTrades = (
  id,
  { token = 1, limit = 25, created_after } = {}
) => {
  const qs = new URLSearchParams({ token, limit });
  if (created_after) qs.append('created_after', created_after);
  return fetchJSON(`${API_BASE}/pairs/${id}/trades?${qs}`);
};
export const getPairReserves = id => fetchJSON(`${API_BASE}/pairs/${id}/reserves`);
