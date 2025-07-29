/* DOM Utilities -----------------------------------------------------------*/

import { CSS_CLASSES } from './constants.js';

/**
 * Utility functions for common DOM operations
 */

/**
 * Safely gets an element by ID
 * @param {string} id - element ID
 * @returns {HTMLElement|null}
 */
export function getElementById(id) {
  return document.getElementById(id);
}

/**
 * Safely queries a selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - parent element (default: document)
 * @returns {HTMLElement|null}
 */
export function querySelector(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Safely queries all matching selectors
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - parent element (default: document)
 * @returns {NodeList}
 */
export function querySelectorAll(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Toggles CSS classes on an element
 * @param {HTMLElement} element - target element
 * @param {string[]} classesToRemove - classes to remove
 * @param {string[]} classesToAdd - classes to add
 */
export function toggleClasses(element, classesToRemove = [], classesToAdd = []) {
  if (!element) return;
  
  if (classesToRemove.length) {
    element.classList.remove(...classesToRemove);
  }
  
  if (classesToAdd.length) {
    element.classList.add(...classesToAdd);
  }
}

/**
 * Sets the text content of an element safely
 * @param {HTMLElement} element - target element
 * @param {string} text - text to set
 */
export function setTextContent(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/**
 * Sets the innerHTML of an element safely
 * @param {HTMLElement} element - target element
 * @param {string} html - HTML to set
 */
export function setInnerHTML(element, html) {
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * Creates a skeleton/loading element
 * @param {string} widthClass - Tailwind width class (e.g., 'w-12')
 * @param {string} heightClass - Tailwind height class (e.g., 'h-4')
 * @param {boolean} isBlock - whether to use block display
 * @returns {string} HTML string for skeleton element
 */
export function createSkeleton(widthClass, heightClass, isBlock = false) {
  const display = isBlock ? 'block' : 'inline-block';
  return `<span class="bg-gray-700 rounded animate-pulse ${display} ${widthClass} ${heightClass} transform translate-y-1"></span>`;
}

/**
 * Applies price change styling based on value
 * @param {HTMLElement} element - target element
 * @param {number} value - price change value
 */
export function applyPriceChangeStyle(element, value) {
  if (!element) return;
  
  // Remove existing price change classes
  element.classList.remove(
    CSS_CLASSES.PRICE_CHANGE.POSITIVE,
    CSS_CLASSES.PRICE_CHANGE.NEGATIVE,
    CSS_CLASSES.PRICE_CHANGE.NEUTRAL
  );
  
  // Apply appropriate class based on value
  if (value > 0) {
    element.classList.add(CSS_CLASSES.PRICE_CHANGE.POSITIVE);
  } else if (value < 0) {
    element.classList.add(CSS_CLASSES.PRICE_CHANGE.NEGATIVE);
  } else {
    element.classList.add(CSS_CLASSES.PRICE_CHANGE.NEUTRAL);
  }
}

/**
 * Creates a debounced function
 * @param {Function} func - function to debounce
 * @param {number} delay - delay in milliseconds
 * @returns {Function} debounced function
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Creates a throttled function
 * @param {Function} func - function to throttle
 * @param {number} delay - delay in milliseconds
 * @returns {Function} throttled function
 */
export function throttle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

/**
 * Safely adds an event listener
 * @param {HTMLElement} element - target element
 * @param {string} event - event type
 * @param {Function} handler - event handler
 * @param {boolean|object} options - event options
 */
export function addEventListener(element, event, handler, options = false) {
  if (element && typeof handler === 'function') {
    element.addEventListener(event, handler, options);
  }
}

/**
 * Safely removes an event listener
 * @param {HTMLElement} element - target element
 * @param {string} event - event type
 * @param {Function} handler - event handler
 * @param {boolean|object} options - event options
 */
export function removeEventListener(element, event, handler, options = false) {
  if (element && typeof handler === 'function') {
    element.removeEventListener(event, handler, options);
  }
}