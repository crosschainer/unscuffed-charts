/* Global State Management ------------------------------------------------*/

import { UI_CONFIG, INTERVALS } from './constants.js';

// Global state
export let currencyUsdPrice = 0;
export const liveRows = [];

// Re-export constants for backward compatibility
export const ROW_HEIGHT = UI_CONFIG.ROW_HEIGHT;
export const ivMs = INTERVALS.CANDLE_INTERVAL;
export const CURRENCY_UPDATE_INTERVAL = INTERVALS.CURRENCY_UPDATE;
export const UI_UPDATE_INTERVAL = INTERVALS.UI_UPDATE;

// Search state
export let searchTerm = '';
export let allPairs = [];
export let hasRealData = false;
export const hydratingContracts = new Set();
export const hydratedPairs = new Set();

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

export const favoritePairs = new Set(
  JSON.parse(localStorage.getItem('favoritePairs') ?? '[]')
);

export function toggleFavorite(id) {
  if (favoritePairs.has(id)) {
    favoritePairs.delete(id);
  } else {
    favoritePairs.add(id);
  }
  // Persist ☑️
  localStorage.setItem('favoritePairs', JSON.stringify([...favoritePairs]));
}

export function isFavorite(id) {
  return favoritePairs.has(id);
}