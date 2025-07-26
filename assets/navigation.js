/* Navigation Management ---------------------------------------------------*/

import { CSS_CLASSES, NAV_LINKS } from './constants.js';

/**
 * Manages navigation state and highlighting
 */
class NavigationManager {
  constructor() {
    this.navElements = {
      trade: document.querySelector(NAV_LINKS.TRADE),
      farms: document.querySelector(NAV_LINKS.FARMS),
      staking: document.querySelector(NAV_LINKS.STAKING)
    };
  }

  /**
   * Sets the active navigation item and updates highlighting
   * @param {string} activeNav - 'trade', 'farms', or 'staking'
   */
  setActive(activeNav) {
    // Reset all navigation items to inactive state
    Object.values(this.navElements).forEach(element => {
      if (element) {
        element.classList.remove(...CSS_CLASSES.NAVIGATION.ACTIVE);
        element.classList.add(...CSS_CLASSES.NAVIGATION.INACTIVE);
      }
    });

    // Set the active navigation item
    const activeElement = this.navElements[activeNav];
    if (activeElement) {
      activeElement.classList.remove(...CSS_CLASSES.NAVIGATION.INACTIVE);
      activeElement.classList.add(...CSS_CLASSES.NAVIGATION.ACTIVE);
    }
  }

  /**
   * Updates navigation based on current route
   * @param {string} route - current route/view
   */
  updateFromRoute(route) {
    switch (route) {
      case 'farms':
        this.setActive('farms');
        break;
      case 'staking':
        this.setActive('staking');
        break;
      default:
        this.setActive('trade');
        break;
    }
  }
}

// Export singleton instance
export const navigationManager = new NavigationManager();