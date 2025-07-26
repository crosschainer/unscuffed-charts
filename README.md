# Xian DEX - Unscuffed Charts

A decentralized exchange interface for the Xian blockchain with real-time trading, farming, and staking capabilities.

## Recent Optimizations (2025-07-26)

The codebase has been significantly optimized for better maintainability while preserving all existing functionality:

### New Utility Modules

#### constants.js
Centralized configuration and constants management.
- **API endpoints and URLs**: All external service URLs in one place
- **Time intervals and delays**: Configurable timing values for polling, caching, etc.
- **UI configuration**: Skeleton counts, dimensions, CSS classes
- **Default values**: Retry counts, timeouts, slippage settings
- **Asset paths**: Centralized file path management
- **Cache configuration**: TTL values and storage keys

#### navigation.js
NavigationManager class for consistent navigation behavior.
- **Centralized nav logic**: Single source of truth for navigation state
- **Automatic highlighting**: Active nav items automatically highlighted
- **Consistent behavior**: Standardized navigation patterns across the app

#### view-manager.js
ViewManager class for centralized view switching.
- **View state management**: Centralized show/hide logic for different sections
- **Consistent transitions**: Standardized view switching behavior
- **Reduced duplication**: Single implementation for view management

#### dom-utils.js
Reusable DOM manipulation utilities.
- **Element selection**: Convenient DOM query helpers
- **Skeleton components**: Reusable loading state generators
- **Event handling**: Debouncing, throttling, and event utilities
- **Performance optimized**: Efficient DOM operations

#### error-handler.js
Standardized error handling and logging system.
- **Severity levels**: Info, warn, error, critical classifications
- **Context-aware logging**: Enhanced error messages with context
- **User-friendly messages**: Consistent error presentation
- **Better debugging**: Improved error tracking and reporting

### Benefits Achieved
- ✅ **50+ magic numbers eliminated**: All hardcoded values moved to constants
- ✅ **Reduced code duplication**: Common patterns extracted to utilities
- ✅ **Better error handling**: Enhanced error reporting with context
- ✅ **Improved performance**: Proper debouncing and throttling
- ✅ **Enhanced maintainability**: Modular structure, easier to modify
- ✅ **100% backward compatibility**: All existing functionality preserved

## Existing Scripts in assets/

### main.js
App bootstrap & glue code (recently optimized with utility modules).  
- Shows initial skeleton UIs, then runs `init()` on `DOMContentLoaded`.  
- Fetches and polls XIAN→USD price using centralized constants for intervals.  
- Loads pair list, normalises & renders sidebar, marks real data ready.  
- Subscribes to the live pairs WebSocket; efficiently updates only changed rows and visible items.  
- Uses proper debouncing from `dom-utils.js` for scroll/resize handlers.  
- Hash‑based routing via `NavigationManager` and `ViewManager` classes.  
- Enhanced error handling with `ErrorHandler` for better debugging.  
- Periodically advances the current empty chart candle and wires timeframe buttons.  
- Exposes `selectPair` globally and a helper `fetchTokenMetadata()` for token validation.  
- Handles mobile sidebar toggle (hamburger/close buttons).

### api.js
REST/WebSocket client + persistent token‑meta cache.

- Exports `API_BASE` / `WS_BASE`, `fetchJSON` (and `throttledFetchJSON`) from `utils.js`.
- TOKEN_CACHE stored in-memory & mirrored to `localStorage` (`xian_token_meta`, schema ver 2) with field-specific TTLs (static/dynamic/logo).
- Batch metadata fetcher: queues contract IDs, hits `/tokens/{a,b,c}` once, resolves per‑token promises; stale entries trigger background refresh.
- Public helper `fetchTokenMeta(contract)` returns fresh/stale meta immediately and refreshes as needed.
- Thin wrappers for REST endpoints: prices, pairs list/detail, candles, trades, reserves, liquidity, etc.
- WebSocket subscribe helpers (`subscribePairCandles`, `subscribePairs`, …) built on `createReconnectingWebSocket`, standardizing callbacks.

### chart.js
LightweightCharts wrapper with client‑side timeframe aggregation.

- Defines 5m as the canonical feed; `TF_MS` + `aggregate()` upsample to 15m–1d buckets.
- `toBar()` normalizes REST/WS candle shapes to `{time, open, high, low, close, volume}`.
- `initEmptyChart()` builds the chart & series (candles + volume histogram) with custom formatting.
- `loadInitialCandles(pairId, denom)` pulls first page of candles, paints, and wires a visible‑range listener for lazy backfill.
- `changeTimeframe(tf)` re-aggregates `baseBars` → `viewBars`, repaints, fits content.
- `onVisibleRangeChanged()` fetches older pages when you scroll to the left edge, dedupes, and stitches gaps.
- `upsertLastCandle(raw)` fills missing OHLCV, updates last/next bar live (both raw and aggregated views).
- Convenience exports: `getAllBars()`, `getLastBar()`, `lastUnixMs()`, `rawToBar()`, `currentInterval()`, plus `getChartInstance()`.

### dapp-func.js
Non‑module script that wires the trade/liquidity UI to XianWalletUtils.

- Bootstraps wallet connection (`connectWallet`) and keeps `userAddress` global; shows a modal on failure.
- Caches tons of DOM refs (trade box, tabs, forms) and toggles them via `setSide('buy'|'sell'|'liquidity')`.
- Balance & price helpers: `getTokenBalance` with retry/backoff, `parseAmount`, `formatPrice`, debounced quote calc (`updateGetAmount`).
- Trade flow (`executeTrade`): approve spend token, build deadline arg, call `swapExactTokenForTokenSupportingFeeOnTransferTokens`, refresh balances.
- Liquidity panel:
  - Fetches user LP data (`fetchUserLiquidity`) and computes share %, token amounts, USD value.
  - Calculates optimal add amounts (`calculateOptimalAmounts`), handles approvals, then `addLiquidity`.
  - Slider-driven removal: approves LP, then `removeLiquidity`.
- Global hook `window.updateTradeBox(...)` syncs UI/state on pair change.
- Pair creation modal: validate tokens via `window.fetchTokenMetadata`, then call `con_pairs.createPair`.
- Toast helper for success/error banners.
- Misc: slippage inputs, special handling for pair #1 (XIAN/USDC) where token order/UI is reversed.

### dapp.js
Utility singleton for talking to the Xian Wallet browser extension (non‑module).

- `XianWalletUtils.init(rpcUrl)` — sets RPC URL once, wires all extension events, and resolves queued promises.
- Promise queues per action (`walletInfo`, `signMessage`, `transaction`); events (`xianWalletInfo`, `xianWalletTxStatus`, etc.) pop and resolve them.
- `waitForWalletReady()` gates calls until the `xianReady` event (2s fallback resolve).
- High‑level ops:
  - `requestWalletInfo()`, `signMessage(message)`, `sendTransaction(contract, method, kwargs, stampLimit)` (30s user‑approval timeouts).
- Tx helpers: `getTxResults(txHash)`, `getTxResultsAsyncBackoff()` (exponential retry), result decoding (`hexToString`, base64 decode).
- Balance queries via ABCI (`getBalanceRequest`, `getApprovedBalanceRequest`) + convenience wrappers (`getBalance`, `getApprovedBalance`).
- Internal constants/state: `rpcUrl`, `isWalletReady`, `initialized`, plus resolver arrays under `state.*`.

### farms.js
Plain script that renders & manages farming pools UI.

- Fetches `farms.txt?v2` (one farm per line), builds a card per farm into `#farmsView .farms-grid`.
- Each card shows APR, reward token, start/end dates, user stake, wallet LP, and harvestable rewards.
- `refresh()` pulls live data via on‑chain helpers (`getFarmsInfo`, `RPCcall`, `getLiq`) and formats it.
- Stake/unstake/harvest actions call the wallet (`XianWalletUtils.sendTransaction`) with the right contracts/functions.
- Handles special UI pieces: “Add Liquidity” link, amount input, enable/disable Harvest button.
- Global `window.refreshFarms()` lets other scripts trigger a re-fetch (e.g., after wallet connect).
- Auto‑inits on DOM ready; shows a spinner while loading and an error message on failure.

### pair-page.js
Module that orchestrates loading & live-updating a selected trading pair.

- `selectPair(pairId)` is the entry point: cancels in‑flight loads, updates the hash, shows skeletons, fetches pair/meta/stats concurrently, boots the chart, and seeds the trade box.
- Race‑proofing: `currentPairSelectionId` + checks after every await; closes old WS connections before opening new ones.
- Stats paint: uses `paintPrice`, `paintVolume`, `paintLiquidity`, `updateMarketCap`; USD conversions via `currencyUsdPrice`.
- Chart flow: `chart.initEmptyChart()` → `loadInitialCandles()` → `fillMissingCandles()` to patch 5m gaps, then timeframe buttons reset.
- WebSockets: price, volume, reserves, candles, and trades each have guarded callbacks; setters in `websockets.js` track/close them (`setCurrent*Ws`).
- Helper glue to global UI bits from `dapp-func.js`: `updateTradeBox`, `refreshBalanceLine`.
- Utility exports: just `selectPair`; internals like `fillMissingCandles`, `setupPairWebSockets`, `setupTradesWebSocket` stay private.

### rpc.js
Thin RPC/GraphQL helper (global namespace) for the Xian node.

- Base URL: `https://node.xian.org` (`RPCURL`).
- Low-level fetchers:
  - `s(url)` JSON GET with toast-on-error.
  - `r(key)` GraphQL `allStates` query.
  - `t(path)` ABCI query helper.
  - Base64/hex utils: `a()`, `n()`, `i()`, `o()` (encode bytes → hex).
- Public globals on `window`:
  - `request_graphi(query)` – raw GraphQL POST.
  - `getReserves(contract, pairIdx)`, `getLiqBalances(contract, pairIdx)`.
  - `getBalance(contract, address)` (simulate_tx).
  - `getApprovedBalance*` variants (allowances).
  - `getFarmsInfo(contract, who, farms[])`, generic `RPCcall(contract, fn, sender, kwargs)`.
  - Pair/token helpers: `getPair(contract, t0, t1)`, `tokenName(contract)`, `tokenTicker(contract)`.
  - LP helpers: `getLiq(contract, pairIdx, addr)`, `getLiqSupply(contract, pairIdx)`, `getAllowance(...)`, `getLiqAllowance(...)`.
- Errors surface via `showToast("RPC error!", "error", 2000)` and console logging.

### sidebar.js
Virtualized sidebar of trading pairs with lazy token‑meta hydration.

- `normalisePairs()` fixes the XIAN/USDC ordering so pair `1` is always `{token0:'currency', token1:'con_usdc'}`.
- Renders buttons only for visible rows (`updateVisibleRows()`); uses top/bottom padding to keep scroll height stable (virtual list).
- Token metadata is hydrated on-demand (`hydrateMetadataIfNeeded`) and cached in `TOKEN_CACHE`; concurrent fetches are deduped.
- Sorting: favorites first (`toggleFavorite`/`isFavorite`), then by 24h USD volume (`toUsdVol()`), re-applied on star toggle.
- `makePairButton()` builds each row: star toggle, pair symbols/logo (placeholder while unhydrated), pct change, USD volume.
- `onSearch()` updates `searchTerm`, rebuilds the list client-side, and hydrates only tokens visible after the filter.
- Public helpers: `renderSidebar`, `refreshSidebarRow`, `upsertRow`, `updateVisibleRows`, `matchesSearch`, `toUsdVol`.
- Clicking a row calls global `window.selectPair()` and collapses sidebar on mobile.

### staking.js
Plain script that builds the staking UI and talks to the on‑chain staking contract.

- Renders a single “Xian Staking” card into `#stakingView .staking-grid`; shows APR, total staked, lock expiry, wallet balance, claimable rewards.
- Global `window.refreshStaking()` fetches live data (simulate/ABCI calls to `con_staking_v1`) and repaints; auto-runs every 15 s.
- Tx helpers: `runTx()` chains approvals and contract calls with a spinner + toasts; used by `stakeTx`, `withdrawTx`, `harvestTx`.
- RPC helpers (`simulate`, `fetchWalletBalance`, `getDepositTime`, `getRewards`) wrap `simulate_tx`/`abci_query` endpoints.
- Handles lock-period math (7 days) and formats numbers defensively (avoid NaN, tiny values).
- Toast utility for user feedback; initializes on DOM ready, shows a loading spinner, and handles failure gracefully.

### state.js
Tiny global store for UI/runtime values.

- Prices & timing: `currencyUsdPrice`, `CURRENCY_UPDATE_INTERVAL` (1 min), `UI_UPDATE_INTERVAL` (1 s), `ivMs` (5 m candle slot).
- Sidebar/virtual list: `liveRows`, `ROW_HEIGHT` (62 px).
- Dataset flags/collections: `allPairs`, `hasRealData`, `hydratingContracts`, `hydratedPairs`.
- Search & scroll state: `searchTerm`, `isScrolling`, `scrollTimeout`.
- Setters: `setCurrencyUsdPrice`, `setSearchTerm`, `setAllPairs`, `setHasRealData`, `setIsScrolling`, `setScrollTimeout`.
- Favorites: `favoritePairs` persisted to `localStorage`; helpers `toggleFavorite(id)`, `isFavorite(id)`.

### trades.js
Builds and maintains the live trades table.

- `prependTrades(list, meta0, meta1)` inserts newest trades at the top (keeps max 40 rows).
- `buildTradeRow(t, meta0, meta1)` computes side/amount/price (inverts for xUSDC, swaps Buy/Sell on USDC/XIAN), formats numbers/time, and returns a `<tr>` that opens the tx on explorer when clicked.
- Uses `timeAgo` and `formatPrice` from `utils.js`, and writes into `els.tradesList`.

### ui-updates.js
Tiny painters for top-bar stats & token info.

- `blinkLive()` kept for backward compatibility (no-op now).
- `tickUpdated()` stamps `#last-updated time` with the current locale time every second.
- `paintPrice(price, pct, meta1)` updates price + % change (desktop & mobile, with green/red classes).
- `paintVolume(vol)` and `paintLiquidity(liq)` format and mirror values to mobile elements.
- `updateMarketCap(newPrice, meta0, meta1)` computes MC (special-case when quote is xUSDC) and writes it to `els.infoTokenMarketCap`, falling back to “Unknown” on bad numbers.

### ui.js
Central DOM refs + loading skeleton painters.

- `els` object grabs all frequently-used elements (sidebar scroller/host pads, price/liquidity/volume fields, chart container, token info, mobile mirrors, etc.).
- `showSidebarSkeleton(count=22)` injects placeholder buttons for pairs (logo + shimmer bars).
- `showMainSkeleton()` paints shimmer placeholders for top stats, mobile stats, logo/chart area, trades table rows, and token info blocks.

### utils.js
Generic helpers: resilient fetchers, array utils, routing, and formatters.

- `fetchJSON(url, opts, retries=10, backoff=200, timeout=5000)` with abort/HTTP5xx retry & exponential backoff.
- `throttledFetchJSON(url, opts, limit=12)` caps concurrent requests via an `inFlight` Set.
- Small utilities: `chunk(arr, size)`, `binarySearch(arr, key, selector)`, `timeAgo(iso)` (“just now”, “5 m ago”…).
- Hash helpers: `getPairFromHash()`, `isFarmsHash()`, `isStakingHash()`, `setPairHash(id)`.
- `formatPrice(value)` chooses decimals based on magnitude (2–10 dp).

### websockets.js
Centralized WebSocket lifecycle + reconnection logic.

- Keeps handles for each stream: `currentTradesWs`, `currentPriceChangeWs`, `currentVolumeWs`, `currentReservesWs`, `currentPairsWs`, `currentCandlesWs`.
- `connectionState` tracks which feeds are live; `updateConnectionState()` toggles the `#live-dot` UI.
- `createReconnectingWebSocket(url, callbacks, wsType)`:
  - Auto‑reconnects (2 s delay, max 5 tries).
  - Wraps `.close()` to mark `manualClose` and stop retries.
  - Parses incoming JSON and calls `onData`, plus `onOpen`/`onError`.
- Getter/setter pairs store sockets and their params for potential reuse.
- `closePairWebSockets()` safely nukes all pair-specific sockets (clears globals first to avoid race callbacks).
- `closeAllWebSockets()` closes the key stat sockets (price/volume/reserves/candles).

Exported helpers: all getters/setters, `closeAllWebSockets`, `closePairWebSockets`, and `createReconnectingWebSocket`.
