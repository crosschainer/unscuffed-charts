/* Live stream connection management --------------------------------------*/

// EventSource connections (legacy `Ws` names are kept for existing imports)
let currentTradesWs = null;
let currentPriceChangeWs = null;
let currentVolumeWs = null;
let currentReservesWs = null;
let currentPairsWs = null;
let currentCandlesWs = null;

// Live connection state
let connectionState = {
  trades: false,
  priceChange: false,
  volume: false,
  reserves: false,
  pairs: false,
  candles: false
};

// Store stream connection parameters for diagnostics
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
  
  // Check if any of the critical streams are connected
  const isConnected = connectionState.priceChange || connectionState.candles;
  
  if (isConnected) {
    liveDot.classList.add('connected');
  } else {
    liveDot.classList.remove('connected');
  }
}

// EventSource reconnects automatically when a stream is interrupted.
function createReconnectingEventSource(url, callbacks, streamType) {
  const source = new EventSource(url);
  let manuallyClosed = false;

  source.addEventListener('open', ev => {
    connectionState[streamType] = true;
    updateConnectionState();
    if (callbacks.onOpen) callbacks.onOpen(ev);
  });

  source.addEventListener('message', ev => {
    try {
      connectionState[streamType] = true;
      updateConnectionState();
      if (callbacks.onData) callbacks.onData(JSON.parse(ev.data));
    } catch (err) {
      console.error('Malformed live-stream message', ev.data);
    }
  });

  source.addEventListener('error', ev => {
    if (manuallyClosed) return;
    connectionState[streamType] = false;
    updateConnectionState();
    if (callbacks.onError) callbacks.onError(ev);
  });

  const originalClose = source.close.bind(source);
  source.close = () => {
    manuallyClosed = true;
    connectionState[streamType] = false;
    updateConnectionState();
    originalClose();
  };

  return source;
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
  // Create a local copy of the stream references to avoid race conditions
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
  
  // Close each stream
  socketsToClose.forEach(ws => {
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        console.warn("Error closing live stream", e);
      }
    }
  });
}

// Export the EventSource creator for use in api.js
export { createReconnectingEventSource };
