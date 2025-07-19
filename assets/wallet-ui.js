/* assets/wallet-ui.js - Handles wallet connection UI interactions */

(() => {
  // DOM elements
  const connectBtn = document.getElementById('connectBtn');
  const connectBtnText = document.getElementById('connectBtnText');
  const walletStatus = document.getElementById('walletStatus');
  
  // State
  let isConnecting = false;
  let isConnected = false;
  let userAddress = null;
  
  // Initialize wallet connection UI
  function init() {
    // Initialize XianWalletUtils
    if (typeof XianWalletUtils !== 'undefined') {
      XianWalletUtils.init();
      
      // Listen for wallet ready event
      document.addEventListener('xianReady', handleWalletReady);
    }
    
    // Add click handler to connect button
    if (connectBtn) {
      connectBtn.addEventListener('click', handleConnectClick);
    }
    
    // Check if wallet is already connected
    checkWalletConnection();
  }
  
  // Handle wallet ready event
  function handleWalletReady() {
    console.log('Wallet is ready');
    
    // Update UI to show wallet is ready
    if (walletStatus) {
      walletStatus.innerHTML = `
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium">Wallet connected</span>
        </div>
      `;
      
      // Hide status after 2 seconds
      setTimeout(() => {
        walletStatus.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => {
          walletStatus.classList.add('hidden');
          walletStatus.classList.remove('opacity-0');
        }, 300);
      }, 2000);
    }
    
    // Update connection state
    isConnecting = false;
    isConnected = true;
    
    // Update button text
    updateConnectButtonUI();
    
    // Get wallet info
    getWalletInfo();
  }
  
  // Handle connect button click
  async function handleConnectClick() {
    if (isConnected) {
      // Already connected - show address or disconnect
      showWalletInfo();
      return;
    }
    
    if (isConnecting) {
      // Already trying to connect
      return;
    }
    
    // Start connection process
    isConnecting = true;
    updateConnectButtonUI();
    
    // Show connection status
    if (walletStatus) {
      walletStatus.classList.remove('hidden');
    }
    
    // Trigger wallet connection
    if (typeof XianWalletUtils !== 'undefined') {
      try {
        // This will trigger the wallet extension popup
        document.dispatchEvent(new CustomEvent('xianWalletConnect'));
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        handleConnectionError(error);
      }
    } else {
      handleConnectionError(new Error('Wallet extension not found'));
    }
  }
  
  // Handle connection error
  function handleConnectionError(error) {
    console.error('Wallet connection error:', error);
    
    // Update UI to show error
    if (walletStatus) {
      walletStatus.innerHTML = `
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div>
            <span class="text-sm font-medium">Connection failed</span>
            <p class="text-xs text-gray-400 mt-1">Please make sure the Xian wallet extension is installed</p>
          </div>
        </div>
      `;
      
      // Hide status after 4 seconds
      setTimeout(() => {
        walletStatus.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => {
          walletStatus.classList.add('hidden');
          walletStatus.classList.remove('opacity-0');
        }, 300);
      }, 4000);
    }
    
    // Reset connection state
    isConnecting = false;
    isConnected = false;
    updateConnectButtonUI();
  }
  
  // Check if wallet is already connected
  async function checkWalletConnection() {
    if (typeof XianWalletUtils !== 'undefined' && XianWalletUtils.isWalletReady) {
      try {
        const info = await XianWalletUtils.requestWalletInfo();
        if (info && info.address) {
          userAddress = info.address;
          isConnected = true;
          updateConnectButtonUI();
        }
      } catch (error) {
        console.warn('Wallet not connected:', error);
      }
    }
  }
  
  // Get wallet info after connection
  async function getWalletInfo() {
    if (!isConnected || typeof XianWalletUtils === 'undefined') {
      return;
    }
    
    try {
      const info = await XianWalletUtils.requestWalletInfo();
      if (info && info.address) {
        userAddress = info.address;
        updateConnectButtonUI();
        
        // Make address available globally
        window.userAddress = userAddress;
        
        // Trigger event for other components
        document.dispatchEvent(new CustomEvent('walletConnected', {
          detail: { address: userAddress }
        }));
        
        // Refresh farms if they exist
        if (typeof window.refreshFarms === 'function') {
          window.refreshFarms();
        }
      }
    } catch (error) {
      console.error('Failed to get wallet info:', error);
    }
  }
  
  // Show wallet info in a toast
  function showWalletInfo() {
    if (!userAddress) return;
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'animate-scale-in px-4 py-3 rounded-lg shadow-lg max-w-xs text-sm font-medium bg-brand-card border border-white/10';
    
    // Format address for display (first 6 and last 4 characters)
    const shortAddress = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
    
    // Set toast content
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-brand-cyan" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
        </svg>
        <div>
          <span class="text-brand-cyan">${shortAddress}</span>
          <div class="flex mt-1 gap-2">
            <button class="copy-address text-xs text-gray-400 hover:text-white transition-colors">
              Copy Address
            </button>
            <span class="text-gray-500">|</span>
            <button class="disconnect text-xs text-gray-400 hover:text-white transition-colors">
              Disconnect
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add to toast container
    document.getElementById('toastContainer').appendChild(toast);
    
    // Add event listeners
    toast.querySelector('.copy-address').addEventListener('click', () => {
      navigator.clipboard.writeText(userAddress)
        .then(() => {
          toast.querySelector('.copy-address').textContent = 'Copied!';
          setTimeout(() => {
            toast.querySelector('.copy-address').textContent = 'Copy Address';
          }, 2000);
        })
        .catch(err => console.error('Failed to copy address:', err));
    });
    
    toast.querySelector('.disconnect').addEventListener('click', () => {
      // Handle disconnect (if supported by wallet)
      isConnected = false;
      userAddress = null;
      window.userAddress = null;
      updateConnectButtonUI();
      
      // Remove toast
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
      
      // Trigger event for other components
      document.dispatchEvent(new CustomEvent('walletDisconnected'));
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
  
  // Update connect button UI based on connection state
  function updateConnectButtonUI() {
    if (!connectBtn || !connectBtnText) return;
    
    if (isConnecting) {
      // Connecting state
      connectBtn.disabled = true;
      connectBtnText.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="animate-spin rounded-full h-3 w-3 border-2 border-t-2 border-brand-cyan"></div>
          <span>Connecting...</span>
        </div>
      `;
    } else if (isConnected && userAddress) {
      // Connected state - show short address
      connectBtn.disabled = false;
      const shortAddress = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
      connectBtnText.textContent = shortAddress;
      
      // Add connected class for styling
      connectBtn.classList.add('connected');
    } else {
      // Not connected state
      connectBtn.disabled = false;
      connectBtnText.textContent = 'Connect Wallet';
      
      // Remove connected class
      connectBtn.classList.remove('connected');
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Export userAddress for global access
  window.getUserAddress = () => userAddress;
})();