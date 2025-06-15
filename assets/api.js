/* Xian-DEX REST wrappers --------------------------------------------------*/
import { fetchJSON } from './utils.js';

export { fetchJSON };   // ← add this
export { throttledFetchJSON } from './utils.js';  // ← add this

export const API_BASE = 'https://xian-api.poc.workers.dev';

const TOKEN_CACHE = {};      // contract → {symbol,name,logo}

export { TOKEN_CACHE };  // ← add this

export async function fetchTokenMeta(contract) {
    if (TOKEN_CACHE[contract]) return TOKEN_CACHE[contract];

    const d = await fetchJSON(`${API_BASE}/tokens/${contract}`);
    const meta = {
        symbol: d.token_symbol || contract.slice(0, 6),
        name: d.token_name || d.symbol || contract,
        logo: d.token_logo_url || d.logo ||
            'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
    };
    TOKEN_CACHE[contract] = meta;
    return meta;
}

/* High-level “endpoint” helpers — keep these pure, no DOM inside! */

export const getCurrencyPrice = () => fetchJSON(`${API_BASE}/pairs/1/pricechange24h?token=0`);
export const getPairs = () => fetchJSON(`${API_BASE}/pairs?limit=100`);
export const getPair = id => fetchJSON(`${API_BASE}/pairs/${id}`);
export const get24hPriceChange = (id, t = 1) => fetchJSON(`${API_BASE}/pairs/${id}/pricechange24h?token=${t}`);
export const get24hVolume = (id, t = 1) => fetchJSON(`${API_BASE}/pairs/${id}/volume24h?token=${t}`);
export const getPairCandles = (id, { interval = '5m', range = '7d', before, token = 0 } = {}) =>
    fetchJSON(`${API_BASE}/pairs/${id}/candles?interval=${interval}&range=${range}` +
        (before ? `&before=${before}` : '') + `&token=${token}`);
export const getPairTrades = (id, { token = 1, limit = 25 } = {}) =>
    fetchJSON(`${API_BASE}/pairs/${id}/trades?token=${token}&limit=${limit}`);
export const getPairReserves = id => fetchJSON(`${API_BASE}/pairs/${id}/reserves`);
