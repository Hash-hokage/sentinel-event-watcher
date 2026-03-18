import { useState, useEffect, useMemo, useRef } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseAbiItem, defineChain, formatEther, parseEther, toHex } from 'viem';
import { SDK } from '@somnia-chain/reactivity';
import { createSessionClient } from '@somnia-chain/viem-session-account';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Radio, Activity, Wallet, Terminal, AlertTriangle, Cpu, Globe, Plus, Trash2, Power, Key, Zap } from 'lucide-react';
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
    "function registerSentinel(uint8 sType, address target, uint256 threshold, address actionTarget, bytes actionData) external returns (uint256)",
    "function getUserSentinels(address user) external view returns (uint256[] memory)",
    "function sentinels(uint256) external view returns (address owner, uint8 sType, address target, uint256 threshold, bool isActive, address actionTarget, bytes actionData)",
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
  
  // Session Account State
  const [sessionSeed, setSessionSeed] = useState('');
  const [sessionClient, setSessionClient] = useState<any>(null);
  const [sessionBalance, setSessionBalance] = useState('0');

  // New Sentinel Form State
  const [newTarget, setNewTarget] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [newType, setNewType] = useState(0);
  const [actionTarget, setActionTarget] = useState('');
  const [actionData, setActionData] = useState('0x');

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

  const initSession = async () => {
    if (!sessionSeed) {
        // Generate a random seed if none exists
        const randomSeed = toHex(crypto.getRandomValues(new Uint8Array(32)));
        setSessionSeed(randomSeed);
        return;
    }
    try {
        const client = await createSessionClient({
            seed: sessionSeed as `0x${string}`,
            chain: somniaTestnet,
            transport: http(),
        });
        setSessionClient(client);
        const bal = await publicClient.getBalance({ address: client.account.address });
        setSessionBalance(formatEther(bal));
    } catch (err) {
        console.error("Session Init Error:", err);
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
            return { 
                id, 
                owner: data[0], 
                sType: data[1], 
                target: data[2], 
                threshold: data[3], 
                isActive: data[4],
                actionTarget: data[5],
                actionData: data[6]
            };
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
            args: [
                newType, 
                newTarget as `0x${string}`, 
                parseEther(newThreshold || '0'), 
                (actionTarget || '0x0000000000000000000000000000000000000000') as `0x${string}`, 
                (actionData || '0x') as `0x${string}`
            ],
            account
        });
        await walletClient.writeContract(request);
        setTimeout(fetchSentinels, 5000);
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

  // Reactive Subscription Logic with Automated Actions
  useEffect(() => {
    let subscription: any;
    if (isWatching && mySentinels.length > 0) {
        const activeSentinels = mySentinels.filter(s => s.isActive);
        const activeTargets = activeSentinels.map(s => s.target);
        
        sdk.subscribe({
            eventContractSources: activeTargets,
            ethCalls: [],
            onData: async (data) => {
                const emitter = data.result.emitter.toLowerCase();
                const matchedSentinel = activeSentinels.find(s => s.target.toLowerCase() === emitter);

                const newEvent = {
                    id: Date.now(),
                    type: matchedSentinel?.actionTarget !== '0x0000000000000000000000000000000000000000' ? "AUTO_REACTIVE_ACTION" : "REACTIVE_SIGNAL",
                    msg: `Signal from ${emitter.slice(0, 10)}... ${matchedSentinel?.actionTarget !== '0x0000000000000000000000000000000000000000' ? '-> EXECUTING ACTION' : ''}`,
                    time: new Date().toLocaleTimeString(),
                    emitter: data.result.emitter
                };
                setEvents(prev => [newEvent, ...prev].slice(0, 50));

                // AUTOMATED ACTION EXECUTION
                if (matchedSentinel && matchedSentinel.actionTarget !== '0x0000000000000000000000000000000000000000' && sessionClient) {
                    try {
                        console.log("Executing Automated Action via Session Account...");
                        const hash = await sessionClient.sendTransaction({
                            to: matchedSentinel.actionTarget,
                            data: matchedSentinel.actionData,
                        });
                        console.log("Action Executed! Hash:", hash);
                        
                        const actionEvent = {
                            id: Date.now() + 1,
                            type: "SESSION_TX_CONFIRMED",
                            msg: `Action sent to ${matchedSentinel.actionTarget.slice(0,10)}...`,
                            time: new Date().toLocaleTimeString(),
                            emitter: "SESSION_ACCOUNT"
                        };
                        setEvents(prev => [actionEvent, ...prev].slice(0, 50));
                    } catch (err) {
                        console.error("Automated Action Failed:", err);
                    }
                }
            }
        }).then(sub => subscription = sub);
    }
    return () => subscription?.unsubscribe();
  }, [isWatching, mySentinels, sdk, sessionClient]);

  return (
    <div className="sentinel-root">
      <div className="scanner-line" />
      <div className="grid-overlay" />

      <nav className="navbar">
        <div className="brand">
          <Shield className="logo-icon" size={24} />
          <span className="brand-text">SENTINEL<span>AUTOMATION</span></span>
        </div>
        <div className="nav-actions">
          {sessionClient && (
            <div className="session-pill">
              <Zap size={14} color="#f59e0b" />
              <span>SESSION: {sessionBalance.slice(0,5)} STT</span>
            </div>
          )}
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
        {/* Left: Configuration & Session */}
        <aside className="control-panel">
          <div className="panel-header">
            <Terminal size={18} /> <h2>AUTOMATION_CONFIG</h2>
          </div>
          
          <div className="session-manager">
            <h3>SESSION_ACCOUNT (NONCELESS)</h3>
            <div className="input-group-row">
                <input 
                    type="password" 
                    placeholder="Enter Session Seed" 
                    value={sessionSeed}
                    onChange={(e) => setSessionSeed(e.target.value)}
                />
                <button onClick={initSession} className="session-btn">
                    <Key size={14} /> {sessionClient ? "RELOAD" : "INIT"}
                </button>
            </div>
            {sessionClient && <p className="session-addr">ADDR: {sessionClient.account.address}</p>}
          </div>

          <div className="add-sentinel-form">
            <h3>REGISTER_REACTIVE_AGENT</h3>
            <select value={newType} onChange={(e) => setNewType(Number(e.target.value))}>
                <option value={0}>WALLET_WATCH</option>
                <option value={1}>PRICE_ALERT</option>
                <option value={2}>SYSTEM_HEALTH</option>
            </select>
            <input type="text" placeholder="Watch Target (0x...)" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
            <input type="number" placeholder="Threshold" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} />
            
            <div className="action-divider">OPTIONAL_AUTOMATED_ACTION</div>
            <input type="text" placeholder="Action Target (0x...)" value={actionTarget} onChange={(e) => setActionTarget(e.target.value)} />
            <input type="text" placeholder="Action Call Data (0x...)" value={actionData} onChange={(e) => setActionData(e.target.value)} />
            
            <button onClick={registerNewSentinel} className="primary-btn full-width"><Plus size={16} /> DEPLOY_AGENT</button>
          </div>

          <div className="my-sentinels">
              <h3>ACTIVE_AGENTS ({mySentinels.length})</h3>
              <div className="sentinel-list">
                  {mySentinels.map((s, idx) => (
                      <div key={idx} className={`sentinel-item ${s.isActive ? 'active' : 'inactive'}`}>
                          <div className="s-info">
                              <span className="s-type">{s.sType === 0 ? "WAL" : s.sType === 1 ? "PRI" : "SYS"}</span>
                              <div className="s-details">
                                <span className="s-target">{s.target.slice(0, 10)}...</span>
                                {s.actionTarget !== '0x0000000000000000000000000000000000000000' && (
                                    <span className="s-action-badge">AUTO</span>
                                )}
                              </div>
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
            {isWatching ? <><Radio size={16} className="spin" /> STOP_AGENTS</> : 'INITIATE_AUTOMATION'}
          </button>
        </aside>

        {/* Right: Live Reactive Action Feed */}
        <section className="feed-container">
          <div className="feed-header">
            <div className="header-title">
              <Globe size={18} /> <h2>AUTOMATED_ACTION_LOG</h2>
            </div>
            <div className="event-counter">{events.length} ACTIONS_INTERCEPTED</div>
          </div>

          <div className="log-window">
            <AnimatePresence initial={false}>
              {events.length === 0 ? (
                <motion.div className="empty-state">
                  <Cpu size={48} strokeWidth={1} />
                  <p>SYSTEM_IDLE: AWAITING_TRIGGER_EVENTS...</p>
                </motion.div>
              ) : (
                events.map((ev) => (
                  <motion.div 
                    key={ev.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`log-entry ${ev.type.toLowerCase()}`}
                  >
                    <div className="log-meta">
                      <span className="log-type">{ev.type}</span>
                      <span className="log-time">{ev.time}</span>
                    </div>
                    <p className="log-msg">{ev.msg}</p>
                    <div className="log-footer">
                      <span className="log-origin">SOURCE: {ev.emitter}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="system-footer">
        <div className="footer-item">REACTIVE_MODE: AUTO</div>
        <div className="footer-item">SESSION_READY: {sessionClient ? "YES" : "NO"}</div>
        <div className="footer-item">SECURITY: OMEGA_REACTIVE</div>
      </footer>
    </div>
  );
}

export default App;
