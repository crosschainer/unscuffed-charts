/* Global State Management ------------------------------------------------*/

// Global state
export let currencyUsdPrice = 0;
export const liveRows = [];
export const ROW_HEIGHT = 56; // px – real height of 1 sidebar row
export const ivMs = 5 * 60 * 1000; // 5 minutes in ms – interval for candles

// Search state
export let searchTerm = '';
export let allPairs = [];
export let hasRealData = false;
export const hydratingContracts = new Set();
export const hydratedPairs = new Set();

// Constants
export const CURRENCY_UPDATE_INTERVAL = 60_000; // 1 minute
export const UI_UPDATE_INTERVAL = 1_000; // 1 second

// Scrolling state
export let isScrolling = false;
export let scrollTimeout = null;

// State setters
export function setCurrencyUsdPrice(price) {
  currencyUsdPrice = price;
}

export function setSearchTerm(term) {
  searchTerm = term;
}

export function setAllPairs(pairs) {
  allPairs = pairs;
}

export function setHasRealData(value) {
  hasRealData = value;
}

export function setIsScrolling(value) {
  isScrolling = value;
}

export function setScrollTimeout(timeout) {
  scrollTimeout = timeout;
}