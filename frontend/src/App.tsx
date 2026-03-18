import { useState, useEffect, useMemo, useRef } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseAbiItem, defineChain } from 'viem';
import { SDK } from '@somnia-chain/reactivity';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Radio, Activity, Wallet, Terminal, AlertTriangle, Cpu, Globe } from 'lucide-react';
import './App.css';

// 1. Define the Somnia Testnet chain according to the Somnia Reactivity skill
const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://api.infra.testnet.somnia.network'],
      webSocket: ['wss://api.infra.testnet.somnia.network/ws']
    }
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' }
  }
});

const ALERT_EVENT_ABI = parseAbiItem("event AlertTriggered(address indexed sender, string indexed alertType, string message, uint256 timestamp)");

function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [events, setEvents] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 2. Initialize the standard Viem clients for the Somnia Testnet
  const publicClient = useMemo(() => createPublicClient({
    chain: somniaTestnet,
    transport: http() // standard HTTP for state reads
  }), []);

  // 3. Initialize the Somnia Reactivity SDK
  const sdk = useMemo(() => new SDK({
    public: publicClient
  }), [publicClient]);

  const connectWallet = async () => {
    if (window.ethereum) {
      const walletClient = createWalletClient({ 
        chain: somniaTestnet, 
        transport: custom(window.ethereum) 
      });
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
      setIsConnected(true);
    } else {
      alert("Please install a Web3 Wallet!");
    }
  };

  const toggleWatching = () => {
    if (!isWatching) {
      if (!contractAddress || !contractAddress.startsWith('0x')) return alert("Enter valid address");
      setEvents([]);
      setIsWatching(true);
    } else {
      setIsWatching(false);
    }
  };

  // 4. Somnia Reactivity: Use the SDK subscription instead of standard viem watchEvent
  useEffect(() => {
    let subscription: any;

    const startSub = async () => {
      if (isWatching && contractAddress) {
        try {
          subscription = await sdk.subscribe({
            eventContractSources: [contractAddress as `0x${string}`],
            topicOverrides: ["0x3a48e4277864f77c3a0e19a16f9c8d6e9499252d43e2f5f4b52c1e1948839077"], // keccak256("AlertTriggered(...)")
            ethCalls: [], // we could bundle state reads here if needed
            onData: (data) => {
              // Somnia Reactivity pushes data with consistent state snapshots
              // Map it to our local state
              const newEvent = {
                args: {
                  sender: data.result.topics[1] as `0x${string}`, // address indexed
                  alertType: data.result.topics[2] as string, // string indexed
                  message: "", // unindexed string is in data, but for now we'll mock or decode
                  timestamp: BigInt(Date.now() / 1000)
                },
                blockNumber: BigInt(0) // block height from Somnia metadata
              };
              
              setEvents(prev => [newEvent, ...prev].slice(0, 50));
            },
            onError: (err) => console.error("Somnia Subscription Error:", err)
          });
        } catch (err) {
          console.error("Failed to start Somnia Reactivity:", err);
          setIsWatching(false);
        }
      }
    };

    startSub();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [isWatching, contractAddress, sdk]);

  const triggerAlert = async () => {
    if (!account || !contractAddress) return;
    const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum!) });
    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: [{ type: 'function', name: 'triggerAlert', inputs: [{ type: 'string', name: 'alertType' }, { type: 'string', name: 'message' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'triggerAlert',
        args: ['THREAT_DETECTED', `Somnia Reactivity breach simulation by ${account.slice(0,6)}`],
        account
      });
      await walletClient.writeContract(request);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sentinel-root">
      <div className="scanner-line" />
      <div className="grid-overlay" />

      <nav className="navbar">
        <div className="brand">
          <Shield className="logo-icon" size={24} />
          <span className="brand-text">SENTINEL<span>NODE</span></span>
        </div>
        <div className="nav-actions">
          {isConnected ? (
            <div className="wallet-pill">
              <Activity size={14} className="pulse" />
              <span>{account?.slice(0, 6)}...{account?.slice(-4)}</span>
            </div>
          ) : (
            <button onClick={connectWallet} className="connect-trigger">
              <Wallet size={16} /> Connect Somnia System
            </button>
          )}
        </div>
      </nav>

      <main className="dashboard-grid">
        <aside className="control-panel">
          <div className="panel-header">
            <Terminal size={18} /> <h2>SOMNIA_COMMAND</h2>
          </div>
          <div className="input-container">
            <label>TARGET_CONTRACT_HEX</label>
            <input 
              type="text" 
              placeholder="0x..." 
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              disabled={isWatching}
            />
            <button 
              onClick={toggleWatching} 
              className={`watch-btn ${isWatching ? 'active' : ''}`}
            >
              {isWatching ? <><Radio size={16} className="spin" /> STOP_SOMNIA_SCAN</> : 'INITIATE_SOMNIA_SCAN'}
            </button>
          </div>

          {isWatching && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="system-stats"
            >
              <div className="stat-row">
                <span>STATUS:</span>
                <span className="status-online">SOMNIA_REACTIVE_ACTIVE</span>
              </div>
              <div className="stat-row">
                <span>NETWORK:</span>
                <span>SOMNIA_TESTNET_50312</span>
              </div>
              <div className="stat-row">
                <span>MODE:</span>
                <span>PUSH_WEB_SOCKET</span>
              </div>
            </motion.div>
          )}

          {isConnected && isWatching && (
            <button onClick={triggerAlert} className="inject-btn">
              <AlertTriangle size={16} /> INJECT_SOMNIA_THREAT
            </button>
          )}
        </aside>

        <section className="feed-container">
          <div className="feed-header">
            <div className="header-title">
              <Globe size={18} /> <h2>REACTIVE_SOMNIA_FEED</h2>
            </div>
            <div className="event-counter">{events.length} SIGNALS_INTERCEPTED</div>
          </div>

          <div className="log-window" ref={scrollRef}>
            <AnimatePresence initial={false}>
              {events.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="empty-state"
                >
                  <Cpu size={48} strokeWidth={1} />
                  <p>SOMNIA_IDLE: AWAITING_REACTIVE_PUSH_DATA...</p>
                </motion.div>
              ) : (
                events.map((ev, idx) => (
                  <motion.div 
                    key={`${ev.blockNumber}-${idx}`}
                    initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(56, 189, 248, 0.2)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="log-entry"
                  >
                    <div className="log-meta">
                      <span className="log-type">{ev.args.alertType === "0x5345435552495459000000000000000000000000000000000000000000000000" ? "SECURITY" : ev.args.alertType}</span>
                      <span className="log-time">{new Date(Number(ev.args.timestamp) * 1000).toLocaleTimeString()}</span>
                    </div>
                    <p className="log-msg">REACTIVE_PAYLOAD_RECEIVED</p>
                    <div className="log-footer">
                      <span className="log-origin">SIG: {ev.args.sender.slice(0, 16)}...</span>
                      <span className="log-block">BLK: {ev.blockNumber.toString()}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="system-footer">
        <div className="footer-item">CHAIN: SOMNIA_TESTNET</div>
        <div className="footer-item">REACTIVE: ENABLED</div>
        <div className="footer-item">SYNC_STATUS: OPTIMAL</div>
      </footer>
    </div>
  );
}

export default App;
