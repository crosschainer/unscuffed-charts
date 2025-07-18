/* Xian‑DEX REST wrappers — with client‑side persistent meta‑cache
   ------------------------------------------------------------------*/

import { fetchJSON } from './utils.js';
export { fetchJSON };                            // re‑export for convenience
export { throttledFetchJSON } from './utils.js';

export const API_BASE = 'https://api.snaklytics.com';
export const WS_BASE  = API_BASE.replace(/^http/, 'ws');  // wss://api.snaklytics.com

/* ──────────────────────────  Persistent TOKEN_CACHE  ────────────────── */
// _fetchedAt is an epoch‑ms timestamp living on every cached entry
// other fields (symbol, name …) are the meta itself.
export const TOKEN_CACHE = /** @type {Record<string, any>} */ ({});

const LS_KEY       = 'xian_token_meta';     // localStorage bucket
const CACHE_VER    = 2;                     // bump if structure changes

// Field‑specific TTLs (ms)
const TTL_STATIC   = 30 * 24 * 60 * 60 * 1e3;   // symbol, name … ≈ 30 days
const TTL_DYNAMIC  =  5 * 60 * 1e3;             // supply, marketCap  ≈ 5 min
const TTL_LOGO     = 24 * 60 * 60 * 1e3;        // logos ≈ 1 day

/* Restore persisted cache on boot */
(function warmCache() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (stored.version === CACHE_VER) Object.assign(TOKEN_CACHE, stored.data || {});
  } catch { /* corrupted JSON → ignore */ }
})();

// Write‑back helper (throttled to next tick)
function persistMeta() {
  clearTimeout(persistMeta._t);
  persistMeta._t = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ version: CACHE_VER, data: TOKEN_CACHE }));
    } catch (e) { console.warn('[meta‑cache] persist failed', e); }
  }, 0);
}

/* ──────────────────────────  Batch fetch machinery  ─────────────────── */
const _pendingContracts = new Set();
const _pendingResolvers = Object.create(null);
let   _batchTimer       = null;

function age(entry) {
  return Date.now() - (entry?._fetchedAt || 0);
}

function isLogoFresh(entry) {
  return age(entry) < TTL_LOGO && Boolean(entry?.logo && entry.logo !== './ph.png');
}

function isFullyFresh(entry) {
  return age(entry) < TTL_STATIC && isLogoFresh(entry) && age(entry) < TTL_DYNAMIC;
}

function scheduleBackgroundRefresh(key) {
  // already queued? bail.
  if (_pendingContracts.has(key)) return;
  _pendingContracts.add(key);
  if (!_batchTimer) _batchTimer = setTimeout(flushPending, 10);
}

async function flushPending() {
  const toFetch = Array.from(_pendingContracts);
  _pendingContracts.clear();
  _batchTimer = null;

  try {
    const raw = await fetchJSON(`${API_BASE}/tokens/${toFetch.join(',')}`);
    const arr = Array.isArray(raw) ? raw : [raw];

    for (const item of arr) {
      const key = item.contractName;

      /* native currency special‑case */
      if (key === 'currency' && !item.total_supply) {
        try {
          const { total_supply } = await fetchJSON(`${API_BASE}/total-supply`);
          item.total_supply = total_supply;
        } catch {/* ignore */}
      }

      const meta = {
        symbol    : item.token_symbol   || key.slice(0, 6),
        name      : item.token_name     || item.token_symbol || key,
        logo      : item.token_logo_url || './ph.png',
        operator  : item.operator       || '—',
        supply    : item.total_supply   || 'Unknown',
        marketCap : item.market_cap     || '—',
        explorer  : item.explorer_url   || `https://explorer.xian.org/tokens/${key}`,
        _fetchedAt: Date.now(),
      };

      TOKEN_CACHE[key] = meta;
      (_pendingResolvers[key] || []).forEach(({ resolve }) => resolve(meta));
      delete _pendingResolvers[key];
    }

    /* reject those the API didn’t return */
    toFetch.filter(k => !TOKEN_CACHE[k]).forEach(k => {
      (_pendingResolvers[k] || []).forEach(({ reject }) => reject(new Error('No metadata returned')));
      delete _pendingResolvers[k];
    });

    persistMeta();
  } catch (err) {
    toFetch.forEach(k => {
      (_pendingResolvers[k] || []).forEach(({ reject }) => reject(err));
      delete _pendingResolvers[k];
    });
  }
}

/* ────────────────────────────  Public API  ──────────────────────────── */
export async function fetchTokenMeta(contract) {
  /* 1) Fast path — serve from cache */
  const cached = TOKEN_CACHE[contract];
  if (cached) {
    if (isFullyFresh(cached)) return cached;          // all good

    // serve stale value but queue background refresh if dynamic bits old
    if (age(cached) > TTL_DYNAMIC || !isLogoFresh(cached)) scheduleBackgroundRefresh(contract);
    return cached;
  }

  /* 2) Otherwise → add to batch fetch queue */
  const promise = new Promise((resolve, reject) => {
    (_pendingResolvers[contract] ||= []).push({ resolve, reject });
  });

  scheduleBackgroundRefresh(contract);
  return promise;
}

/* ──────────────────────────  REST endpoints  ─────────────────────────── */
export const getCurrencyPrice = () =>
  fetchJSON(`${API_BASE}/pairs/1/pricechange24h?token=0`);

export function getPairs({ offset = 0, limit = 100, order = 'desc' } = {}) {
  const qs = new URLSearchParams({ offset, limit, order });
  return fetchJSON(`${API_BASE}/pairs?${qs}`);
}
export const getPair          = id => fetchJSON(`${API_BASE}/pairs/${id}`);
export const get24hPriceChange = (id, t = 1) =>
  fetchJSON(`${API_BASE}/pairs/${id}/pricechange24h?token=${t}`);
export const get24hVolume      = (id, t = 1) =>
  fetchJSON(`${API_BASE}/pairs/${id}/volume24h?token=${t}`);
export const getUserLiquidity  = (id, addr) =>
  fetchJSON(`${API_BASE}/pairs/${id}/liquidity${addr}`);
export const getPairCandles = (
  id,
  { interval = '5m', range = '7d', before, limit, after, token = 0 } = {}
) => {
  const qs = new URLSearchParams({ interval, range, token });
  if (before) qs.append('before', before);
  if (limit)  qs.append('limit',  limit);
  if (after)  qs.append('after',  after);
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

/* ─────────────────────  WebSocket helpers  ────────────────── */
import { createReconnectingWebSocket } from './websockets.js';

function _subscribe(path, onData, onError, onOpen, wsType) {
  const url = WS_BASE + path;
  const callbacks = { onData, onError, onOpen };
  return createReconnectingWebSocket(url, callbacks, wsType);
}

export const subscribePairCandles = (id, token, interval = '5m', cb = {}) =>
  _subscribe(`/ws/pairs/${id}/candles?token=${token}&interval=${interval}`, cb.onData, cb.onError, cb.onOpen, 'candles');
export const subscribePairVolume24h = (id, token, cb = {}) =>
  _subscribe(`/ws/pairs/${id}/volume24h?token=${token}`, cb.onData, cb.onError, cb.onOpen, 'volume');
export const subscribePairPriceChange24h = (id, token, cb = {}) =>
  _subscribe(`/ws/pairs/${id}/pricechange24h?token=${token}`, cb.onData, cb.onError, cb.onOpen, 'priceChange');
export const subscribePairTrades = (id, token, cb = {}) =>
  _subscribe(`/ws/pairs/${id}/trades?token=${token}&limit=25`, cb.onData, cb.onError, cb.onOpen, 'trades');
export const subscribePairReserves = (id, cb = {}) =>
  _subscribe(`/ws/pairs/${id}/reserves`, cb.onData, cb.onError, cb.onOpen, 'reserves');
export const subscribePairs = (cb = {}) =>
  _subscribe('/ws/pairs', cb.onData, cb.onError, cb.onOpen, 'pairs');
