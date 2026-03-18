import { useState, useEffect, useMemo, useRef } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseAbiItem, defineChain, formatEther, parseEther } from 'viem';
import { SDK } from '@somnia-chain/reactivity';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Radio, Activity, Wallet, Terminal, AlertTriangle, Cpu, Globe, Plus, Trash2, Power } from 'lucide-react';
import './App.css';

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

const REGISTRY_ABI = [
    "function registerSentinel(uint8 sType, address target, uint256 threshold) external returns (uint256)",
    "function getUserSentinels(address user) external view returns (uint256[] memory)",
    "function sentinels(uint256) external view returns (address owner, uint8 sType, address target, uint256 threshold, bool isActive)",
    "function toggleSentinel(uint256 id) external",
    "event SentinelCreated(uint256 indexed id, address indexed owner, uint8 indexed sType, address target, uint256 threshold)"
] as const;

function App() {
  const [registryAddress, setRegistryAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [mySentinels, setMySentinels] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  
  // New Sentinel Form State
  const [newTarget, setNewTarget] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [newType, setNewType] = useState(0);

  const publicClient = useMemo(() => createPublicClient({
    chain: somniaTestnet,
    transport: http()
  }), []);

  const sdk = useMemo(() => new SDK({ public: publicClient }), [publicClient]);

  const connectWallet = async () => {
    if (window.ethereum) {
      const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum) });
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
      setIsConnected(true);
    }
  };

  const fetchSentinels = async () => {
    if (!account || !registryAddress) return;
    try {
        const ids = await publicClient.readContract({
            address: registryAddress as `0x${string}`,
            abi: REGISTRY_ABI,
            functionName: 'getUserSentinels',
            args: [account]
        });

        const configs = await Promise.all(ids.map(async (id) => {
            const data = await publicClient.readContract({
                address: registryAddress as `0x${string}`,
                abi: REGISTRY_ABI,
                functionName: 'sentinels',
                args: [id]
            });
            return { id, owner: data[0], sType: data[1], target: data[2], threshold: data[3], isActive: data[4] };
        }));
        setMySentinels(configs);
    } catch (err) {
        console.error("Fetch error:", err);
    }
  };

  const registerNewSentinel = async () => {
    if (!account || !registryAddress) return;
    const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum!) });
    try {
        const { request } = await publicClient.simulateContract({
            address: registryAddress as `0x${string}`,
            abi: REGISTRY_ABI,
            functionName: 'registerSentinel',
            args: [newType, newTarget as `0x${string}`, parseEther(newThreshold)],
            account
        });
        await walletClient.writeContract(request);
        setTimeout(fetchSentinels, 5000); // Poll for update
    } catch (err) {
        console.error(err);
    }
  };

  const toggleSentinel = async (id: bigint) => {
      const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum!) });
      try {
          const { request } = await publicClient.simulateContract({
              address: registryAddress as `0x${string}`,
              abi: REGISTRY_ABI,
              functionName: 'toggleSentinel',
              args: [id],
              account: account!
          });
          await walletClient.writeContract(request);
          setTimeout(fetchSentinels, 5000);
      } catch (err) {
          console.error(err);
      }
  };

  useEffect(() => {
    if (isConnected && registryAddress) fetchSentinels();
  }, [isConnected, registryAddress]);

  // Reactive Subscription Logic
  useEffect(() => {
    let subscription: any;
    if (isWatching && mySentinels.length > 0) {
        const activeTargets = mySentinels.filter(s => s.isActive).map(s => s.target);
        
        sdk.subscribe({
            eventContractSources: activeTargets,
            ethCalls: [],
            onData: (data) => {
                const newEvent = {
                    id: Date.now(),
                    type: "SOMNIA_REACTIVE_SIGNAL",
                    msg: `Signal detected from target ${data.result.emitter.slice(0, 10)}...`,
                    time: new Date().toLocaleTimeString(),
                    emitter: data.result.emitter
                };
                setEvents(prev => [newEvent, ...prev].slice(0, 50));
            }
        }).then(sub => subscription = sub);
    }
    return () => subscription?.unsubscribe();
  }, [isWatching, mySentinels, sdk]);

  return (
    <div className="sentinel-root">
      <div className="scanner-line" />
      <div className="grid-overlay" />

      <nav className="navbar">
        <div className="brand">
          <Shield className="logo-icon" size={24} />
          <span className="brand-text">SENTINEL<span>REGISTRY</span></span>
        </div>
        <div className="nav-actions">
          {isConnected ? (
            <div className="wallet-pill">
              <Activity size={14} className="pulse" />
              <span>{account?.slice(0, 6)}...{account?.slice(-4)}</span>
            </div>
          ) : (
            <button onClick={connectWallet} className="connect-trigger">
              <Wallet size={16} /> Link Wallet
            </button>
          )}
        </div>
      </nav>

      <main className="dashboard-grid large">
        {/* Left: Registry Controls */}
        <aside className="control-panel">
          <div className="panel-header">
            <Terminal size={18} /> <h2>REGISTRY_MANAGER</h2>
          </div>
          
          <div className="input-container">
            <label>REGISTRY_CONTRACT</label>
            <input 
              type="text" 
              placeholder="0x..." 
              value={registryAddress}
              onChange={(e) => setRegistryAddress(e.target.value)}
            />
          </div>

          <div className="add-sentinel-form">
            <h3>CREATE_NEW_SENTINEL</h3>
            <select value={newType} onChange={(e) => setNewType(Number(e.target.value))}>
                <option value={0}>WALLET_WATCH</option>
                <option value={1}>PRICE_ALERT</option>
                <option value={2}>SYSTEM_HEALTH</option>
            </select>
            <input type="text" placeholder="Target Address (0x...)" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
            <input type="number" placeholder="Threshold (e.g. 100)" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} />
            <button onClick={registerNewSentinel} className="primary-btn full-width"><Plus size={16} /> REGISTER</button>
          </div>

          <div className="my-sentinels">
              <h3>MY_ACTIVE_SENTINELS ({mySentinels.length})</h3>
              <div className="sentinel-list">
                  {mySentinels.map((s, idx) => (
                      <div key={idx} className={`sentinel-item ${s.isActive ? 'active' : 'inactive'}`}>
                          <div className="s-info">
                              <span className="s-type">{s.sType === 0 ? "WAL" : s.sType === 1 ? "PRI" : "SYS"}</span>
                              <span className="s-target">{s.target.slice(0, 10)}...</span>
                          </div>
                          <button onClick={() => toggleSentinel(s.id)} className="toggle-icon">
                              <Power size={14} color={s.isActive ? "#10b981" : "#64748b"} />
                          </button>
                      </div>
                  ))}
              </div>
          </div>

          <button 
            onClick={() => setIsWatching(!isWatching)} 
            className={`watch-btn ${isWatching ? 'active' : ''}`}
          >
            {isWatching ? <><Radio size={16} className="spin" /> STOP_SCAN</> : 'INITIATE_MULTISCAN'}
          </button>
        </aside>

        {/* Center: Live Reactive Feed */}
        <section className="feed-container">
          <div className="feed-header">
            <div className="header-title">
              <Globe size={18} /> <h2>REACTIVE_OMNISCIENT_FEED</h2>
            </div>
            <div className="event-counter">{events.length} SIGNALS_CAPURED</div>
          </div>

          <div className="log-window">
            <AnimatePresence initial={false}>
              {events.length === 0 ? (
                <motion.div className="empty-state">
                  <Cpu size={48} strokeWidth={1} />
                  <p>SYSTEM_IDLE: AWAITING_PUSH_FROM_{mySentinels.filter(s=>s.isActive).length}_TARGETS...</p>
                </motion.div>
              ) : (
                events.map((ev) => (
                  <motion.div 
                    key={ev.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="log-entry reactive"
                  >
                    <div className="log-meta">
                      <span className="log-type">REACTIVE_PUSH</span>
                      <span className="log-time">{ev.time}</span>
                    </div>
                    <p className="log-msg">{ev.msg}</p>
                    <div className="log-footer">
                      <span className="log-origin">EMITTER: {ev.emitter}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="system-footer">
        <div className="footer-item">STATUS: {isWatching ? "SCANNING" : "STANDBY"}</div>
        <div className="footer-item">REGISTRY: {registryAddress || "NOT_LINKED"}</div>
        <div className="footer-item">CORE: SOMNIA_OMNI_V1</div>
      </footer>
    </div>
  );
}

export default App;
