/* View Management ---------------------------------------------------------*/

import { VIEWS } from './constants.js';
import { navigationManager } from './navigation.js';

/**
 * Manages application view switching
 */
class ViewManager {
  constructor() {
    this.views = {
      loading: document.getElementById(VIEWS.LOADING),
      trade: document.getElementById(VIEWS.TRADE),
      farms: document.getElementById(VIEWS.FARMS),
      staking: document.getElementById(VIEWS.STAKING),
      mobileHeader: document.getElementById(VIEWS.MOBILE_HEADER)
    };
  }

  /**
   * Hides all views
   */
  hideAllViews() {
    Object.values(this.views).forEach(view => {
      if (view) {
        view.style.display = 'none';
      }
    });
  }

  /**
   * Shows a specific view and hides others
   * @param {string} viewName - name of the view to show
   * @param {string} displayStyle - CSS display style (default: 'flex')
   */
  showView(viewName, displayStyle = 'flex') {
    this.hideAllViews();
    
    const view = this.views[viewName];
    if (view) {
      view.style.display = displayStyle;
    }
  }

  /**
   * Shows the loading view
   */
  showLoading() {
    this.showView('loading');
  }

  /**
   * Shows the trade/pairs view
   */
  showTrade() {
    this.showView('trade');
    this.showMobileHeader();
    navigationManager.setActive('trade');
  }

  /**
   * Shows the farms view
   */
  showFarms() {
    this.showView('farms');
    this.hideMobileHeader();
    navigationManager.setActive('farms');
  }

  /**
   * Shows the staking view
   */
  showStaking() {
    this.showView('staking');
    this.hideMobileHeader();
    navigationManager.setActive('staking');
  }

  /**
   * Shows the mobile header
   */
  showMobileHeader() {
    if (this.views.mobileHeader && this.views.mobileHeader.classList.contains('hidden')) {
      this.views.mobileHeader.classList.remove('hidden');
    }
  }

  /**
   * Hides the mobile header
   */
  hideMobileHeader() {
    if (this.views.mobileHeader && !this.views.mobileHeader.classList.contains('hidden')) {
      this.views.mobileHeader.classList.add('hidden');
    }
  }
}

// Export singleton instance
export const viewManager = new ViewManager();