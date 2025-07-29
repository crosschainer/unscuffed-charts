/* Error Handling ----------------------------------------------------------*/

/**
 * Centralized error handling utilities
 */

/**
 * Error types for categorization
 */
export const ERROR_TYPES = {
  NETWORK: 'network',
  API: 'api',
  WEBSOCKET: 'websocket',
  WALLET: 'wallet',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Standardized error class
 */
export class AppError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error handler class
 */
class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
  }

  /**
   * Handles and logs errors
   * @param {Error|AppError} error - error to handle
   * @param {string} context - context where error occurred
   * @param {boolean} showToUser - whether to show error to user
   */
  handle(error, context = 'Unknown', showToUser = false) {
    const errorInfo = {
      message: error.message,
      type: error.type || ERROR_TYPES.UNKNOWN,
      severity: error.severity || ERROR_SEVERITY.MEDIUM,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    // Log to console based on severity
    this.logError(errorInfo);

    // Add to error log
    this.addToLog(errorInfo);

    // Show to user if requested and appropriate
    if (showToUser && this.shouldShowToUser(errorInfo)) {
      this.showUserError(errorInfo);
    }

    return errorInfo;
  }

  /**
   * Logs error to console with appropriate level
   * @param {object} errorInfo - error information
   */
  logError(errorInfo) {
    const logMessage = `[${errorInfo.context}] ${errorInfo.message}`;
    
    switch (errorInfo.severity) {
      case ERROR_SEVERITY.CRITICAL:
        console.error('🔴 CRITICAL:', logMessage, errorInfo);
        break;
      case ERROR_SEVERITY.HIGH:
        console.error('🟠 ERROR:', logMessage, errorInfo);
        break;
      case ERROR_SEVERITY.MEDIUM:
        console.warn('🟡 WARNING:', logMessage, errorInfo);
        break;
      case ERROR_SEVERITY.LOW:
        console.info('🔵 INFO:', logMessage, errorInfo);
        break;
      default:
        console.log('⚪ LOG:', logMessage, errorInfo);
    }
  }

  /**
   * Adds error to internal log
   * @param {object} errorInfo - error information
   */
  addToLog(errorInfo) {
    this.errorLog.unshift(errorInfo);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
  }

  /**
   * Determines if error should be shown to user
   * @param {object} errorInfo - error information
   * @returns {boolean}
   */
  shouldShowToUser(errorInfo) {
    // Don't show low severity errors to users
    if (errorInfo.severity === ERROR_SEVERITY.LOW) {
      return false;
    }

    // Show network and wallet errors to users
    if ([ERROR_TYPES.NETWORK, ERROR_TYPES.WALLET].includes(errorInfo.type)) {
      return true;
    }

    // Show critical errors
    if (errorInfo.severity === ERROR_SEVERITY.CRITICAL) {
      return true;
    }

    return false;
  }

  /**
   * Shows error to user (using existing toast system if available)
   * @param {object} errorInfo - error information
   */
  showUserError(errorInfo) {
    // Try to use existing toast system
    if (typeof window.showToast === 'function') {
      const message = this.getUserFriendlyMessage(errorInfo);
      window.showToast(message, 'error', 3000);
    } else {
      // Fallback to alert (not ideal but ensures user sees critical errors)
      if (errorInfo.severity === ERROR_SEVERITY.CRITICAL) {
        alert(`Error: ${errorInfo.message}`);
      }
    }
  }

  /**
   * Converts technical error to user-friendly message
   * @param {object} errorInfo - error information
   * @returns {string}
   */
  getUserFriendlyMessage(errorInfo) {
    switch (errorInfo.type) {
      case ERROR_TYPES.NETWORK:
        return 'Network connection issue. Please check your internet connection.';
      case ERROR_TYPES.WALLET:
        return 'Wallet connection issue. Please check your wallet extension.';
      case ERROR_TYPES.API:
        return 'Service temporarily unavailable. Please try again later.';
      case ERROR_TYPES.WEBSOCKET:
        return 'Live data connection lost. Attempting to reconnect...';
      case ERROR_TYPES.VALIDATION:
        return errorInfo.message; // Validation messages are usually user-friendly
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Gets recent errors
   * @param {number} count - number of recent errors to get
   * @returns {object[]}
   */
  getRecentErrors(count = 10) {
    return this.errorLog.slice(0, count);
  }

  /**
   * Clears error log
   */
  clearLog() {
    this.errorLog = [];
  }

  /**
   * Creates a network error
   * @param {string} message - error message
   * @param {Error} originalError - original error
   * @returns {AppError}
   */
  createNetworkError(message, originalError = null) {
    return new AppError(message, ERROR_TYPES.NETWORK, ERROR_SEVERITY.MEDIUM, originalError);
  }

  /**
   * Creates a wallet error
   * @param {string} message - error message
   * @param {Error} originalError - original error
   * @returns {AppError}
   */
  createWalletError(message, originalError = null) {
    return new AppError(message, ERROR_TYPES.WALLET, ERROR_SEVERITY.HIGH, originalError);
  }

  /**
   * Creates an API error
   * @param {string} message - error message
   * @param {Error} originalError - original error
   * @returns {AppError}
   */
  createApiError(message, originalError = null) {
    return new AppError(message, ERROR_TYPES.API, ERROR_SEVERITY.MEDIUM, originalError);
  }

  /**
   * Creates a WebSocket error
   * @param {string} message - error message
   * @param {Error} originalError - original error
   * @returns {AppError}
   */
  createWebSocketError(message, originalError = null) {
    return new AppError(message, ERROR_TYPES.WEBSOCKET, ERROR_SEVERITY.LOW, originalError);
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions
export const handleError = (error, context, showToUser = false) => 
  errorHandler.handle(error, context, showToUser);

export const createNetworkError = (message, originalError) => 
  errorHandler.createNetworkError(message, originalError);

export const createWalletError = (message, originalError) => 
  errorHandler.createWalletError(message, originalError);

export const createApiError = (message, originalError) => 
  errorHandler.createApiError(message, originalError);

export const createWebSocketError = (message, originalError) => 
  errorHandler.createWebSocketError(message, originalError);