# 🛡️ Sentinel Event Watcher
### Autonomous On-Chain Monitoring Powered by Somnia Native Reactivity

**Network:** Somnia Testnet (Chain ID: 50312)
**Hackathon Track:** Native Reactivity

---

## What Is Somnia Native Reactivity?

Traditional blockchains are passive — dApps must continuously poll for new data, run off-chain bots, or rely on third-party indexers to detect on-chain events. Somnia inverts this model entirely. The **Somnia Reactivity Precompile** (deployed at address `0x0100`) allows smart contracts to *subscribe* to on-chain events and receive automatic callbacks *within the same block* the event occurs. When a subscribed event fires, validators invoke the handler contract's `onEvent()` function directly — no external infrastructure, no cron jobs, no latency. This makes Somnia the first L1 where the blockchain itself acts as the event bus.

---

## How This Project Uses Reactivity

This is the most important section for understanding the project. Every component — from the core contracts to the frontend — is built around Somnia's native reactivity. Here is every place reactivity is used:

### 1. BlockTick Subscription — Autonomous Price Monitoring

**Contract:** `SentinelHandler.sol` → `subscribeToBlockTick()`

The handler registers a subscription with the Reactivity Precompile (`0x0100`) to receive the `BlockTick(uint64)` system event. This event is emitted by Somnia validators on every single block.

```
Flow: Somnia Validator → emits BlockTick(uint64) → Precompile (0x0100) invokes handler.onEvent()
```

When the precompile invokes `onEvent()`, the internal `_onEvent()` function checks if the emitter is the precompile address (`SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS`). If so, it calls `_processPriceChecks()`, which iterates through all sentinels registered as `PRICE_ALERT` type and reads the `MockPriceOracle` for each monitored asset. If the current price exceeds the sentinel's threshold, a `PriceThresholdAlert` event is emitted and the `priceAlertsProcessed` counter increments.

**Why this matters:** Price monitoring runs on every block with zero external triggers. No keeper bot, no cron job, no off-chain infrastructure. The blockchain *itself* drives the monitoring loop.

### 2. Per-Emitter Event Subscriptions — Reactive Signal Processing

**Contracts:** `SentinelHandler.sol` → `subscribeToEmitter()`, `SentinelRegistry.sol` → `registerSentinel()`

When a user registers a new sentinel via `SentinelRegistry.registerSentinel()`, the registry automatically calls `handler.subscribeToEmitter(target)` if a handler is configured (line 137 in `SentinelRegistry.sol`). This creates a per-emitter subscription with the precompile — subscribing to *all events* from that specific contract address using wildcard `eventTopics`.

```
Flow: User calls registerSentinel(BRIDGE_WATCH, MockBridge, ...) 
      → Registry calls handler.subscribeToEmitter(MockBridge)
      → Handler calls PRECOMPILE.subscribe(...) with emitter = MockBridge
      → Precompile now monitors MockBridge for ANY event
      → When MockBridge emits DepositInitiated, precompile invokes handler.onEvent()
```

Inside `_onEvent()`, the handler checks if the emitter matches either the `monitoredSentinel` address or a target registered in the registry (`registry.isTargetRegistered(emitter)`). If matched, it increments `reactiveCallCount` and emits `ReactiveActionProcessed` with the alert type.

**Why this matters:** Subscription creation is fully automated — users don't need to manually call the precompile. The registry-to-handler wiring means every new sentinel is immediately reactive.

### 3. Frontend Real-Time Push via Somnia Reactivity SDK

**File:** `frontend/src/App.tsx` → `sdk.subscribe()`

The dashboard uses `@somnia-chain/reactivity` SDK to establish a WebSocket connection to the Somnia node. On page load (`isWatching` defaults to `true`), the frontend subscribes to events from three system contracts:

- `SentinelHandler` (`0xe95d...`) — reactive action events
- `SentinelRegistry` (`0xeaf2...`) — sentinel creation events  
- `MockPriceOracle` (`0xf586...`) — price update events

Plus any active user sentinel targets.

```typescript
const systemSources = [HANDLER_ADDRESS, REGISTRY_ADDRESS, ORACLE_ADDRESS];
const userTargets = mySentinels.filter(s => s.isActive).map(s => s.target);
const allSources = [...new Set([...systemSources, ...userTargets])];

sdk.subscribe({
  eventContractSources: allSources,
  onData: async (data) => { /* instant UI update */ }
});
```

When a reactive event fires on-chain, the SDK pushes it to the browser instantly. Each event includes the source block number, displayed as `⚡ block #1,234,567` in the log feed. The dashboard also polls the handler's on-chain state (`reactiveCallCount`, `priceAlertsProcessed`, `blockTickSubId`) every 8 seconds to display live reactivity metrics.

**Why this matters:** No `eth_getLogs` polling loops, no subgraph, no indexer. The browser receives events the moment the chain reacts — within milliseconds of the transaction landing.

### 4. Automated Execution via Session Accounts

**File:** `frontend/src/App.tsx` → `sessionClient.sendTransaction()`

When a sentinel has an `actionTarget` configured (a non-zero address), the reactive callback in the SDK subscription triggers an automated transaction using `@somnia-chain/viem-session-account`. The session account is a disposable key that executes transactions without requiring the user to sign each one manually, and without nonces — preventing stuck transactions during high-throughput reactive execution.

```
Flow: On-chain event → SDK push → Frontend detects sentinel match 
      → sessionClient.sendTransaction({ to: actionTarget, data: actionData })
      → Automated action executes on-chain without user interaction
```

**Why this matters:** The full loop — event detection, reactive callback, and automated execution — happens without any human intervention. The user configures a sentinel once, and the system reacts autonomously.

---

## ⚡ Reproducing the Reactivity Demo

### Terminal 1 — Start the Dashboard
```bash
cd frontend && npm install && npm run dev
```
Open http://localhost:5173 — the dashboard begins listening immediately. No wallet connection required.

### Terminal 2 — Trigger a Price Reactive Event
```bash
cast send 0xf586CdD8386e5692b8AB7ef04572700d69eE533C \
  "setPrice(address,uint256)" \
  0x0000000000000000000000000000000000000001 1500 \
  --rpc-url https://api.infra.testnet.somnia.network \
  --account somniaDeployer
```

### Terminal 2 — Trigger a Bridge Reactive Event
```bash
cast send 0x7f75521779Ae4CDD3c5eC9fd33221B1E07073dfc \
  "deposit(address,uint256,uint256)" \
  0x0000000000000000000000000000000000000001 1000000000000000000 1 \
  --rpc-url https://api.infra.testnet.somnia.network \
  --account somniaDeployer
```

Watch the REACTIVE_INTELLIGENCE feed update in real time — no page refresh, no polling. Events arrive within milliseconds of the transaction landing on-chain, pushed directly by the Somnia Reactivity Precompile at `0x0100`.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Somnia Validators                                           │
│  ┌───────────────────────────────────────────┐               │
│  │  Reactivity Precompile (0x0100)           │               │
│  │  • Manages subscriptions                  │               │
│  │  • Emits BlockTick(uint64) every block    │               │
│  │  • Routes events to handler contracts     │               │
│  └──────────┬───────────────┬────────────────┘               │
│             │               │                                │
│    BlockTick callback    Per-emitter callback                │
│             │               │                                │
│  ┌──────────▼───────────────▼────────────────┐               │
│  │  SentinelHandler (SomniaEventHandler)     │               │
│  │  • _onEvent() routes by emitter address   │               │
│  │  • _processPriceChecks() on BlockTick     │               │
│  │  • Emits ReactiveActionProcessed          │               │
│  └──────────────────────────────────────────┘│               │
│                                               │               │
│  ┌────────────────────────────────────────────┐              │
│  │  SentinelRegistry                          │              │
│  │  • Stores sentinel configs                 │              │
│  │  • Auto-calls subscribeToEmitter() on      │              │
│  │    new sentinel registration               │              │
│  └────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
                        │  WSS Push
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  Frontend Dashboard                                          │
│  • @somnia-chain/reactivity SDK (WebSocket)                  │
│  • @somnia-chain/viem-session-account (Nonceless TX)         │
│  • Live on-chain stats: reactiveCallCount, priceAlerts       │
│  • Real-time block number display                            │
└──────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- **`SentinelHandler` inherits from `SomniaEventHandler`** — the base class from `@somnia-chain/reactivity-contracts` that provides the `onEvent()` external function and routes to the internal `_onEvent()` override.
- **BlockTick vs Per-Emitter subscriptions** — BlockTick subscribes to the precompile itself for periodic callbacks; per-emitter subscriptions monitor specific contract addresses for any event they emit. Both types are managed through the same precompile at `0x0100`.
- **Registry → Handler auto-subscription** — When `registerSentinel()` is called, the registry automatically calls `handler.subscribeToEmitter(target)`, removing any manual subscription step and ensuring every sentinel is immediately reactive.

---

## 🎯 Use Cases

| Type | Description | How Reactivity Enables It |
|---|---|---|
| **PRICE_ALERT** | Monitors asset prices against user-defined thresholds | Every block, the `BlockTick` subscription triggers `_processPriceChecks()` — no external keeper or bot required |
| **BRIDGE_WATCH** | Intercepts cross-chain bridge deposit events | Per-emitter subscription on the bridge contract pushes `DepositInitiated` events to the handler automatically |
| **WALLET_WATCH** | Monitors specific EOA transfer activity | Per-emitter subscription captures any event from the target address without polling |
| **SYSTEM_HEALTH** | Monitors system-level health metrics via the core Sentinel alerts | Direct alerts from `SentinelCore` trigger `ReactiveActionProcessed` through the precompile callback |

---

## 📦 Live Deployed Contracts

| Contract | Address | Purpose |
|---|---|---|
| SentinelRegistry | `0xeaf2c62c7486c10dac2a1afa31ebcb40759a6ed2` | Source of truth for all sentinel configurations |
| SentinelHandler | `0xe95d0a5ec446bf84117961d0ae3ccd2452c451d1` | Reactive handler invoked by the precompile |
| SentinelCore | `0x9FeD00Dc284464e66C996dF0fc3ee24e440ED660` | Global alert emitter |
| MockPriceOracle | `0xf586CdD8386e5692b8AB7ef04572700d69eE533C` | Simulated price feed for testing |
| MockBridge | `0x7f75521779Ae4CDD3c5eC9fd33221B1E07073dfc` | Simulated bridge for testing |

---

## 🔧 Setup & Deployment

### Smart Contracts (Foundry)
```bash
cd contracts && npm install
forge test
```

Deploy to Somnia Testnet:
```bash
forge script script/DeploySomnia.s.sol \
  --rpc-url https://api.infra.testnet.somnia.network \
  --broadcast \
  --account somniaDeployer \
  --gas-estimate-multiplier 200
```

### Post-Deployment: Activate Reactivity
After deployment, fund the handler with ≥32 STT and activate the BlockTick subscription:
```bash
cast send <HANDLER_ADDRESS> "subscribeToBlockTick()" \
  --rpc-url https://api.infra.testnet.somnia.network \
  --account somniaDeployer
```

Per-emitter subscriptions are created automatically when sentinels are registered through the registry.

### Frontend (React + Vite)
```bash
cd frontend && npm install
npm run dev
```

### Project Structure
```
├── contracts/          # Solidity Smart Contracts
│   ├── src/            # Core: Sentinel, Registry, Handler
│   ├── test/           # Foundry test suite (13 tests)
│   └── script/         # Somnia deployment scripts
├── frontend/           # React + Vite Dashboard
│   └── src/            # Reactivity SDK & Viem integration
├── deployments.json    # Live contract addresses
└── REACTIVITY_DEMO.md  # Quick-start demo guide
```

---

## 🛡 Security & Verification
- **Access Control:** Only authorized emitters can trigger global system alerts (`OnlyAuthorized` modifier).
- **Input Validation:** Action targets must be valid contracts (`InvalidActionTarget` custom error).
- **Custom Errors:** All revert paths use gas-efficient custom errors instead of string reverts.
- **Test Coverage:** 13 Foundry tests covering authorization, registration, price alerts, bridge events, and access control edge cases.

---

## 📊 V3 Dashboard Features
- **Signal Intensity Chart:** Real-time Recharts visualization of incoming reactive signals
- **Event Distribution:** Breakdown of alert types (Price, Wallet, Bridge, System)
- **On-Chain Stats:** Live polling of `reactiveCallCount`, `priceAlertsProcessed`, and `blockTickSubId`
- **Architecture Diagram:** Visual flow showing Emitter → Precompile → Handler → Dashboard
- **Block Number:** Live block counter updating every second
- **Copy-to-Clipboard:** Interactive contract address pills in the navbar
- **Session Management:** One-click disposable session key generation for automated execution

---

*Built with ❤️ for the Somnia Ecosystem.*
