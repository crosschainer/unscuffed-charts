/* Application Constants and Configuration --------------------------------*/

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://api.snaklytics.com',
  get WS_BASE() { return this.BASE_URL.replace(/^http/, 'ws'); },
  RPC_URL: 'https://node.xian.org'
};

// Time Intervals (in milliseconds)
export const INTERVALS = {
  CURRENCY_UPDATE: 60_000,      // 1 minute
  UI_UPDATE: 1_000,             // 1 second
  CANDLE_INTERVAL: 5 * 60 * 1000, // 5 minutes
  SCROLL_DEBOUNCE: 50,          // 50ms
  EMPTY_CANDLE_ADVANCE: 60 * 1000, // 1 minute
  RECONNECT_DELAY: 2000,        // 2 seconds
  WALLET_TIMEOUT: 30000         // 30 seconds
};

// Cache Configuration
export const CACHE_CONFIG = {
  VERSION: 2,
  LOCAL_STORAGE_KEY: 'xian_token_meta',
  TTL: {
    STATIC: 30 * 24 * 60 * 60 * 1e3,   // 30 days
    DYNAMIC: 5 * 60 * 1e3,              // 5 minutes
    LOGO: 24 * 60 * 60 * 1e3            // 1 day
  }
};

// UI Configuration
export const UI_CONFIG = {
  ROW_HEIGHT: 62,               // px - sidebar row height
  SIDEBAR_SKELETON_COUNT: 22,   // number of skeleton rows
  TRADES_SKELETON_COUNT: 5,     // number of skeleton trade rows
  MAX_TRADES_DISPLAY: 40,       // maximum trades to show
  THROTTLE_LIMIT: 12,           // concurrent request limit
  MAX_RECONNECT_ATTEMPTS: 5     // WebSocket reconnection attempts
};

// CSS Classes
export const CSS_CLASSES = {
  NAVIGATION: {
    ACTIVE: ['text-brand-cyan', 'border-brand-cyan'],
    INACTIVE: ['text-gray-300', 'border-transparent']
  },
  SIDEBAR: {
    OPEN: ['-translate-x-full', 'pointer-events-none'],
    CLOSED: []
  },
  PRICE_CHANGE: {
    POSITIVE: 'text-emerald-400',
    NEGATIVE: 'text-rose-400',
    NEUTRAL: 'text-gray-400'
  }
};

// View IDs
export const VIEWS = {
  LOADING: 'loadingView',
  TRADE: 'tradeView', 
  FARMS: 'farmsView',
  STAKING: 'stakingView',
  MOBILE_HEADER: 'mobilePairHeader'
};

// Navigation Links
export const NAV_LINKS = {
  TRADE: 'a[href="/#pair=1"]',
  FARMS: 'a[href="/#farms"]',
  STAKING: 'a[href="/#staking"]'
};

// Default Values
export const DEFAULTS = {
  SLIPPAGE: 10,                 // default slippage percentage
  RETRY_COUNT: 10,              // default fetch retry count
  BACKOFF_DELAY: 200,           // initial backoff delay
  TIMEOUT: 5000,                // request timeout
  PAIR_LIMIT: 1031,             // pairs API limit
  THROTTLE_LIMIT: 12            // concurrent request limit
};

// File Paths
export const ASSETS = {
  PLACEHOLDER_IMAGE: './assets/ph.png',
  FAVICON: '/assets/favicon.svg',
  LOGO: 'assets/logo.svg',
  FARMS_CONFIG: 'farms.txt?v2'
};

// Contract Addresses and Special Cases
export const CONTRACTS = {
  XIAN_USDC_PAIR: 1,            // special pair ID for XIAN/USDC
  CURRENCY_TOKEN: 'currency',
  USDC_TOKEN: 'con_usdc'
};