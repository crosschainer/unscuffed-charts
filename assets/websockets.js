/* WebSocket Connection Management -----------------------------------------*/

// WebSocket connections
let currentTradesWs = null;
let currentPriceChangeWs = null;
let currentVolumeWs = null;
let currentReservesWs = null;
let currentPairsWs = null;
let currentCandlesWs = null;

export function getCurrentTradesWs() {
  return currentTradesWs;
}

export function setCurrentTradesWs(ws) {
  currentTradesWs = ws;
}

export function getCurrentPriceChangeWs() {
  return currentPriceChangeWs;
}

export function setCurrentPriceChangeWs(ws) {
  currentPriceChangeWs = ws;
}

export function getCurrentVolumeWs() {
  return currentVolumeWs;
}

export function setCurrentVolumeWs(ws) {
  currentVolumeWs = ws;
}

export function getCurrentReservesWs() {
  return currentReservesWs;
}

export function setCurrentReservesWs(ws) {
  currentReservesWs = ws;
}

export function getCurrentPairsWs() {
  return currentPairsWs;
}

export function setCurrentPairsWs(ws) {
  currentPairsWs = ws;
}

export function getCurrentCandlesWs() {
  return currentCandlesWs;
}

export function setCurrentCandlesWs(ws) {
  currentCandlesWs = ws;
}

export function closeAllWebSockets() {
  [currentPriceChangeWs, currentVolumeWs, currentReservesWs, currentCandlesWs].forEach(ws => {
    if (ws) ws.close();
  });
}

export function closePairWebSockets() {
  [currentTradesWs, currentPriceChangeWs, currentVolumeWs, currentReservesWs, currentCandlesWs].forEach(ws => {
    if (ws) ws.close();
  });
}