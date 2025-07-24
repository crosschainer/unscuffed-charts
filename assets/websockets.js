/* WebSocket Connection Management -----------------------------------------*/

// WebSocket connections
let currentTradesWs = null;
let currentPriceChangeWs = null;
let currentVolumeWs = null;
let currentReservesWs = null;
let currentPairsWs = null;
let currentCandlesWs = null;

// WebSocket connection state
let connectionState = {
  trades: false,
  priceChange: false,
  volume: false,
  reserves: false,
  pairs: false,
  candles: false
};

// WebSocket reconnection configuration
const RECONNECT_DELAY = 2000; // 2 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

// Store WebSocket connection parameters for reconnection
let wsParams = {
  trades: null,
  priceChange: null,
  volume: null,
  reserves: null,
  pairs: null,
  candles: null
};

// Update connection state and UI
function updateConnectionState() {
  const liveDot = document.getElementById('live-dot');
  if (!liveDot) return;
  
  // Check if any of the critical websockets are connected
  const isConnected = connectionState.priceChange || connectionState.candles;
  
  if (isConnected) {
    liveDot.classList.add('connected');
  } else {
    liveDot.classList.remove('connected');
  }
}

// Create a websocket with reconnection capability
function createReconnectingWebSocket(url, callbacks, wsType) {
  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimeout = null;
  
  const connect = () => {
    ws = new WebSocket(url);
    
    ws.addEventListener('open', (ev) => {
      reconnectAttempts = 0;
      connectionState[wsType] = true;
      updateConnectionState();
      if (callbacks.onOpen) callbacks.onOpen(ev);
    });
    
    ws.addEventListener('error', (ev) => {
      connectionState[wsType] = false;
      updateConnectionState();
      if (callbacks.onError) callbacks.onError(ev);
    });
    
    ws.addEventListener('close', (ev) => {
      connectionState[wsType] = false;
      updateConnectionState();
      
      // Only attempt to reconnect if this wasn't a manual close
      if (!ws.manualClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        reconnectTimeout = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    });
    
    ws.addEventListener('message', (ev) => {
      try {
        if (callbacks.onData) callbacks.onData(JSON.parse(ev.data));
      } catch (err) {
        console.error('Malformed WS message', ev.data);
      }
    });
    
    return ws;
  };
  
  const socket = connect();
  
  // Add a custom close method that prevents reconnection
  socket.manualClose = false;
  const originalClose = socket.close;
  socket.close = function() {
    socket.manualClose = true;
    clearTimeout(reconnectTimeout);
    connectionState[wsType] = false;
    updateConnectionState();
    return originalClose.apply(this, arguments);
  };
  
  return socket;
}

export function getCurrentTradesWs() {
  return currentTradesWs;
}

export function setCurrentTradesWs(ws, params = null) {
  if (params) wsParams.trades = params;
  currentTradesWs = ws;
}

export function getCurrentPriceChangeWs() {
  return currentPriceChangeWs;
}

export function setCurrentPriceChangeWs(ws, params = null) {
  if (params) wsParams.priceChange = params;
  currentPriceChangeWs = ws;
}

export function getCurrentVolumeWs() {
  return currentVolumeWs;
}

export function setCurrentVolumeWs(ws, params = null) {
  if (params) wsParams.volume = params;
  currentVolumeWs = ws;
}

export function getCurrentReservesWs() {
  return currentReservesWs;
}

export function setCurrentReservesWs(ws, params = null) {
  if (params) wsParams.reserves = params;
  currentReservesWs = ws;
}

export function getCurrentPairsWs() {
  return currentPairsWs;
}

export function setCurrentPairsWs(ws, params = null) {
  if (params) wsParams.pairs = params;
  currentPairsWs = ws;
}

export function getCurrentCandlesWs() {
  return currentCandlesWs;
}

export function setCurrentCandlesWs(ws, params = null) {
  if (params) wsParams.candles = params;
  currentCandlesWs = ws;
}

export function closeAllWebSockets() {
  [currentPriceChangeWs, currentVolumeWs, currentReservesWs, currentCandlesWs].forEach(ws => {
    if (ws) ws.close();
  });
}

export function closePairWebSockets() {
  // Create a local copy of the WebSocket references to avoid race conditions
  const socketsToClose = [
    currentTradesWs, 
    currentPriceChangeWs, 
    currentVolumeWs, 
    currentReservesWs, 
    currentCandlesWs
  ];
  
  // Clear the global references immediately to prevent callbacks from using them
  currentTradesWs = null;
  currentPriceChangeWs = null;
  currentVolumeWs = null;
  currentReservesWs = null;
  currentCandlesWs = null;
  
  // Update connection state
  connectionState.trades = false;
  connectionState.priceChange = false;
  connectionState.volume = false;
  connectionState.reserves = false;
  connectionState.candles = false;
  updateConnectionState();
  
  // Close each WebSocket
  socketsToClose.forEach(ws => {
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        console.warn("Error closing WebSocket", e);
      }
    }
  });
}

// Export the reconnecting WebSocket creator for use in api.js
export { createReconnectingWebSocket };