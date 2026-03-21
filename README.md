# 🛡️ Sentinel Event Watcher: High-Performance Autonomous Monitoring for Somnia

The Sentinel Event Watcher is a production-grade, autonomous monitoring and execution engine built natively for the **Somnia Blockchain**. It leverages Somnia’s unique L1 architecture to provide real-time, push-based alerts and automated on-chain responses through signature-free execution.

---

## 🚀 Native Somnia Reactivity: The Architecture

At the heart of this project is **Somnia's Reactive Layer**, which enables the blockchain to "push" events directly to smart contracts and frontends, eliminating the need for inefficient off-chain indexers or continuous polling.

### 1. The Reactive Handler (`SentinelHandler.sol`)
Unlike traditional smart contracts, the `SentinelHandler` inherits from `SomniaEventHandler`. It is specifically designed to be invoked by the **Somnia Reactivity Precompile (0x0100)**.
*   **Event Interception:** It monitors multiple sources—including user-defined monitoring targets (Whales, Bridge contracts) and system-level events.
*   **BlockTick Subscriptions:** The handler subscribes to the `BlockTick(uint64)` event emitted by the Somnia precompile. This allows the system to perform high-frequency logic (like price oracle checks) on every single block without external triggers.
*   **Gas Optimization:** Following Somnia's best practices, the handler is built to minimize state reads, keeping the "cold storage" overhead to zero for maximum throughput.

### 2. The Omniscient Registry (`SentinelRegistry.sol`)
Users register their monitoring intents in the registry. Each registration acts as a "Reactive Agent":
*   **WALLET_WATCH:** Monitors specific EOA movements.
*   **PRICE_ALERT:** Triggers when a price (monitored via the reactive BlockTick) crosses a threshold.
*   **SYSTEM_HEALTH:** Monitors system-level health metrics.
*   **BRIDGE_WATCH:** Intercepts cross-chain bridge events to secure assets in transit.

### 3. Tactical Command Dashboard (Frontend)
The frontend uses the **Somnia Reactivity SDK** for atomic, real-time data pushes.
*   **WebSockets over Polling:** Using `sdk.subscribe`, the dashboard establishes a direct websocket connection to the Somnia Testnet.
*   **Atomic State Pushes:** When an event is emitted on-chain, the UI updates instantly without requiring a page refresh or a manual fetch.

---

## ⚡ Automated Actions via Session Accounts

Sentinel integrates **Viem Session Accounts** to allow autonomous execution.
*   **Signature-Free Execution:** Once a "Session Seed" is funded, the Sentinel can execute on-chain trades or defensive maneuvers (like moving assets) automatically when a trigger occurs.
*   **Nonceless Transactions:** Leverages Somnia's support for nonceless transactions, preventing "stuck" transactions during high-volatility events.

---

## 🛠 Project Structure

```bash
├── contracts/          # Solidity Smart Contracts
│   ├── src/            # Core logic (Sentinel, Registry, Handler)
│   ├── test/           # Rigorous Foundry test suite (100% Coverage)
│   └── script/         # One-click Somnia deployment scripts
└── frontend/           # Tactical React + Vite Dashboard
    └── src/            # Somnia Reactivity SDK & Viem Integration
```

---

## 🔧 Technical Setup & Deployment

### Smart Contracts (Foundry)
1. **Install Dependencies:**
   ```bash
   cd contracts && npm install
   ```
2. **Run Tests:**
   ```bash
   forge test
   ```
3. **Deploy to Somnia Testnet:**
   ```bash
    forge script script/DeploySomnia.s.sol --rpc-url https://api.infra.testnet.somnia.network --broadcast --gas-estimate-multiplier 200
    ```

### Deployed Contracts (Somnia Testnet — Chain ID 50312)
| Contract | Address |
|---|---|
| SentinelRegistry | `0xeaf2c62c7486c10dac2a1afa31ebcb40759a6ed2` |
| SentinelHandler | `0xe95d0a5ec446bf84117961d0ae3ccd2452c451d1` |
| SentinelCore | `0x9FeD00Dc284464e66C996dF0fc3ee24e440ED660` |
| MockPriceOracle | `0xf586CdD8386e5692b8AB7ef04572700d69eE533C` |
| MockBridge | `0x7f75521779Ae4CDD3c5eC9fd33221B1E07073dfc` |

### Frontend (React + Vite)
1. **Install Dependencies:**
   ```bash
   cd frontend && npm install
   ```
2. **Start Dashboard:**
   ```bash
   npm run dev
   ```

---

## 📊 V3 Tactical Dashboard Features
*   **Signal Intensity (Recharts):** Real-time visualization of incoming reactive signals.
*   **Event Distribution:** Breakdown of alert types (Price, Wallet, Bridge).
*   **Autonomous Agent Toggle:** Enable/Disable individual reactive agents on-the-fly.
*   **Session Management:** Securely fund and monitor your autonomous session account.

---

## 🛡 Security & Verification
The Sentinel system has been built with **security-first** principles:
*   **Access Control:** Only authorized emitters can trigger global system alerts.
*   **Input Validation:** Strict validation for action targets in the registry.
*   **Formal Verification:** Exhaustive test suite covering both "Happy" and "Unhappy" execution paths.

---

*Built with ❤️ for the Somnia Ecosystem.*
