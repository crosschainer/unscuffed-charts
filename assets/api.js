/* Xian-DEX REST wrappers --------------------------------------------------*/
import { fetchJSON } from './utils.js';

export { fetchJSON };   // ← add this
export { throttledFetchJSON } from './utils.js';  // ← add this

export const API_BASE = 'https://api.snaklytics.com';
export const WS_BASE  = API_BASE.replace(/^http/, 'ws');  // "wss://api.snaklytics.com"

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
        for (const item of arr) {
          const key = item.contractName;

          /* ── native-currency special case ── */
          if (key === 'currency' && !item.total_supply) {
            try {
              const { total_supply } = await fetchJSON(`${API_BASE}/total-supply`);
              item.total_supply = total_supply;
            } catch { /* network error?  leave supply as '—' */ }
          }

          const meta = {
            symbol   : item.token_symbol   || key.slice(0,6),
            name     : item.token_name     || item.token_symbol || key,
            logo     : item.token_logo_url || './ph.png',
            operator : item.operator       || '—',
            supply   : item.total_supply   || 'Unknown',
            marketCap: item.market_cap     || '—',
            explorer : item.explorer_url   ||
                      `https://explorer.xian.org/tokens/${key}`,
          };

          TOKEN_CACHE[key] = meta;
          (_pendingResolvers[key] || []).forEach(({ resolve }) => resolve(meta));
          delete _pendingResolvers[key];
        }
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
/* WebSocket subscription helpers --------------------------------------------------*/

/**
 * Open a WebSocket, JSON.parse each message, and call `onData`.
 * Returns the WebSocket instance (so caller can .close()).
 */
/**
 * Low-level helper to open a WS and wire up handlers.
 * @param {string} path   – e.g. '/ws/pairs/1/reserves?token=0'
 * @param {Function} onData
 * @param {Function} onError
 * @param {Function} onOpen
 * @returns {WebSocket}
 */
export function _subscribe(path, onData, onError, onOpen) {
  const ws = new WebSocket(WS_BASE + path);

  ws.addEventListener('open', event => {
    if (onOpen) onOpen(event);
  });

  ws.addEventListener('error', event => {
    console.error('WebSocket error for', path, event);
    if (onError) onError(event);
  });

  ws.addEventListener('message', event => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.error('Malformed WS message', event.data);
      return;
    }
    // forward *every* valid JSON message to your onData
    if (onData) onData(msg);
  });

  return ws;
}

/**
 * Subscribe to live candle updates for a pair.
 * @returns WebSocket
 */
export function subscribePairCandles(
  pairId, token, interval = '5m',
  { onData, onError, onOpen } = {}
) {
  return _subscribe(
    `/ws/pairs/${pairId}/candles?token=${token}&interval=${interval}`,
    onData,
    onError,
    onOpen
  );
}

/** Live 24h volume updates */
export function subscribePairVolume24h(
  pairId, token,
  { onData, onError, onOpen } = {}
) {
  return _subscribe(
    `/ws/pairs/${pairId}/volume24h?token=${token}`,
    onData,
    onError,
    onOpen
  );
}

/** Live 24h price-change & price updates */
export function subscribePairPriceChange24h(
  pairId, token,
  { onData, onError, onOpen } = {}
) {
  return _subscribe(
    `/ws/pairs/${pairId}/pricechange24h?token=${token}`,
    onData,
    onError,
    onOpen
  );
}

/** Live trades */
export function subscribePairTrades(
  pairId, token,
  { onData, onError, onOpen } = {}
) {
  return _subscribe(
    `/ws/pairs/${pairId}/trades?token=${token}&limit=25`,
    onData,
    onError,
    onOpen
  );
}

/** Live reserves */
export function subscribePairReserves(
  pairId,
  { onData, onError, onOpen } = {}
) {
  return _subscribe(
    `/ws/pairs/${pairId}/reserves`,
    onData,
    onError,
    onOpen
  );
}

/** Live new pairs listing */
export function subscribePairs(
  { onData, onError, onOpen } = {}
) {
  return _subscribe(
    `/ws/pairs`,
    onData,
    onError,
    onOpen
  );
}