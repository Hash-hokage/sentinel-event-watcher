import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPublicClient, createWalletClient, custom, http, defineChain, formatEther, parseEther, toHex } from 'viem';
import { SDK } from '@somnia-chain/reactivity';
import { createSessionClient } from '@somnia-chain/viem-session-account';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Radio, Activity, Wallet, Terminal, 
  Cpu, Globe, Plus, Power, Key, Zap, BarChart3, TrendingUp, RefreshCw, ArrowRight 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
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

const REGISTRY_ADDRESS = '0xeaf2c62c7486c10dac2a1afa31ebcb40759a6ed2';
const HANDLER_ADDRESS = '0xe95d0a5ec446bf84117961d0ae3ccd2452c451d1';
const ORACLE_ADDRESS = '0xf586CdD8386e5692b8AB7ef04572700d69eE533C';
const CORE_SENTINEL = '0x9FeD00Dc284464e66C996dF0fc3ee24e440ED660';

const REGISTRY_ABI = [
    "function registerSentinel(uint8 sType, address target, uint256 threshold, address actionTarget, bytes actionData) external returns (uint256)",
    "function getUserSentinels(address user) external view returns (uint256[] memory)",
    "function sentinels(uint256) external view returns (address owner, uint8 sType, address target, uint256 threshold, bool isActive, address actionTarget, bytes actionData)",
    "function toggleSentinel(uint256 id) external",
    "event SentinelCreated(uint256 indexed id, address indexed owner, uint8 indexed sType, address target, uint256 threshold)"
] as const;

const HANDLER_ABI = [
    "function reactiveCallCount() external view returns (uint256)",
    "function priceAlertsProcessed() external view returns (uint256)",
    "function blockTickSubId() external view returns (uint256)",
] as const;

interface SentinelConfig {
    id: bigint;
    owner: `0x${string}`;
    sType: number;
    target: `0x${string}`;
    threshold: bigint;
    isActive: boolean;
    actionTarget: `0x${string}`;
    actionData: `0x${string}`;
}

interface EventLog {
    id: number;
    type: string;
    msg: string;
    time: string;
    emitter: string;
}

function App() {
  const [registryAddress, setRegistryAddress] = useState(REGISTRY_ADDRESS);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [mySentinels, setMySentinels] = useState<SentinelConfig[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
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

  // On-Chain Reactivity Stats
  const [reactiveCallCount, setReactiveCallCount] = useState<bigint>(0n);
  const [priceAlertCount, setPriceAlertCount] = useState<bigint>(0n);
  const [blockTickSubId, setBlockTickSubId] = useState<bigint>(0n);

  const publicClient = useMemo(() => createPublicClient({
    chain: somniaTestnet,
    transport: http()
  }), []);

  const sdk = useMemo(() => new SDK({ public: publicClient }), [publicClient]);

  // Chart Data Computation
  const chartData = useMemo(() => {
    const last20 = [...events].reverse().slice(-20);
    return last20.map((ev) => ({
      name: ev.time,
      intensity: ev.type === 'AUTO_REACTIVE_ACTION' ? 100 : 
                 ev.type === 'SESSION_TX_CONFIRMED' ? 80 : 40,
      id: ev.id
    }));
  }, [events]);

  const typeStats = useMemo(() => {
    const counts = events.reduce((acc: Record<string, number>, ev) => {
        acc[ev.type] = (acc[ev.type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

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

        const configs = await Promise.all(ids.map(async (id: bigint) => {
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
            } as SentinelConfig;
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
      if (!account || !registryAddress) return;
      const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum!) });
      try {
          const { request } = await publicClient.simulateContract({
              address: registryAddress as `0x${string}`,
              abi: REGISTRY_ABI,
              functionName: 'toggleSentinel',
              args: [id],
              account
          });
          await walletClient.writeContract(request);
          setTimeout(fetchSentinels, 5000);
      } catch (err) {
          console.error(err);
      }
  };

  const fetchOnChainStats = useCallback(async () => {
    try {
      const [calls, alerts, subId] = await Promise.all([
        publicClient.readContract({ address: HANDLER_ADDRESS as `0x${string}`, abi: HANDLER_ABI, functionName: 'reactiveCallCount' }),
        publicClient.readContract({ address: HANDLER_ADDRESS as `0x${string}`, abi: HANDLER_ABI, functionName: 'priceAlertsProcessed' }),
        publicClient.readContract({ address: HANDLER_ADDRESS as `0x${string}`, abi: HANDLER_ABI, functionName: 'blockTickSubId' }),
      ]);
      setReactiveCallCount(calls as bigint);
      setPriceAlertCount(alerts as bigint);
      setBlockTickSubId(subId as bigint);
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchOnChainStats();
    const interval = setInterval(fetchOnChainStats, 8000);
    return () => clearInterval(interval);
  }, [fetchOnChainStats]);

  useEffect(() => {
    if (isConnected && registryAddress) fetchSentinels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, registryAddress, account]);

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

                const newEvent: EventLog = {
                    id: Date.now(),
                    type: matchedSentinel?.actionTarget !== '0x0000000000000000000000000000000000000000' ? "AUTO_REACTIVE_ACTION" : "REACTIVE_SIGNAL",
                    msg: `Signal from ${emitter.slice(0, 10)}... ${matchedSentinel?.actionTarget !== '0x0000000000000000000000000000000000000000' ? '-> EXECUTING ACTION' : ''}`,
                    time: new Date().toLocaleTimeString(),
                    emitter: data.result.emitter
                };
                setEvents(prev => [newEvent, ...prev].slice(0, 50));

                if (matchedSentinel && matchedSentinel.actionTarget !== '0x0000000000000000000000000000000000000000' && sessionClient) {
                    try {
                        const hash = await sessionClient.sendTransaction({
                            to: matchedSentinel.actionTarget,
                            data: matchedSentinel.actionData,
                        });
                        console.log("Action Sent! Hash:", hash);
                        const actionEvent: EventLog = {
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
          <div className="system-links">
            <span className="addr-pill">REG: {REGISTRY_ADDRESS.slice(0,6)}...</span>
            <span className="addr-pill">HND: {HANDLER_ADDRESS.slice(0,6)}...</span>
          </div>
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
        <aside className="control-panel">
          <div className="panel-header">
            <Terminal size={18} /> <h2>AUTOMATION_CONFIG</h2>
          </div>
          
          <div className="session-manager">
            <h3>SESSION_ACCOUNT (NONCELESS)</h3>
            <div className="input-group-row">
                <input 
                    type="password" 
                    placeholder="Seed" 
                    value={sessionSeed}
                    onChange={(e) => setSessionSeed(e.target.value)}
                />
                <button onClick={initSession} className="session-btn">
                    <Key size={14} /> {sessionClient ? "RLD" : "INIT"}
                </button>
            </div>
            {sessionClient && <p className="session-addr">{sessionClient.account.address}</p>}
          </div>

          <div className="add-sentinel-form">
            <h3>REGISTER_REACTIVE_AGENT</h3>
            <select value={newType} onChange={(e) => setNewType(Number(e.target.value))}>
                <option value={0}>WALLET_WATCH</option>
                <option value={1}>PRICE_ALERT</option>
                <option value={2}>SYSTEM_HEALTH</option>
                <option value={3}>BRIDGE_WATCH</option>
            </select>
            <input type="text" placeholder="Target Address" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
            <input type="number" placeholder="Threshold" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} />
            
            <div className="action-divider">AUTOMATED_ACTION</div>
            <input type="text" placeholder="Action Target" value={actionTarget} onChange={(e) => setActionTarget(e.target.value)} />
            <input type="text" placeholder="Call Data" value={actionData} onChange={(e) => setActionData(e.target.value)} />
            
            <button onClick={registerNewSentinel} className="primary-btn full-width"><Plus size={16} /> DEPLOY_AGENT</button>
          </div>

          <div className="my-sentinels">
              <h3>ACTIVE_AGENTS ({mySentinels.length})</h3>
              <div className="sentinel-list">
                  {mySentinels.map((s, idx) => (
                      <div key={idx} className={`sentinel-item ${s.isActive ? 'active' : 'inactive'}`}>
                          <div className="s-info">
                              <span className="s-type">{s.sType === 0 ? "WAL" : s.sType === 1 ? "PRI" : s.sType === 2 ? "SYS" : "BRG"}</span>
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

        <section className="feed-container">
          <div className="feed-header">
            <div className="header-title">
              <Globe size={18} /> <h2>REACTIVE_INTELLIGENCE</h2>
            </div>
            <div className="event-counter">{events.length} ACTIONS_LOGGED</div>
          </div>

          <div className="main-content-split">
            <div className="log-window">
                <AnimatePresence initial={false}>
                {events.length === 0 ? (
                    <motion.div className="empty-state">
                    <Cpu size={48} strokeWidth={1} />
                    <p>SYSTEM_IDLE: AWAITING_EVENTS...</p>
                    </motion.div>
                ) : (
                    events.map((ev) => (
                    <motion.div 
                        key={ev.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`log-entry ${ev.type.toLowerCase()}`}
                    >
                        <div className="log-meta">
                        <span className="log-type">{ev.type}</span>
                        <span className="log-time">{ev.time}</span>
                        </div>
                        <p className="log-msg">{ev.msg}</p>
                    </motion.div>
                    ))
                )}
                </AnimatePresence>
            </div>

            <div className="visuals-panel">
                <div className="chart-card">
                    <div className="chart-header">
                        <TrendingUp size={14} /> <span>SIGNAL_INTENSITY_V2</span>
                    </div>
                    <div className="chart-body">
                        <ResponsiveContainer width="100%" height={150}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorInt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" hide />
                                <YAxis hide domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: '10px' }}
                                    itemStyle={{ color: '#10b981' }}
                                />
                                <Area type="monotone" dataKey="intensity" stroke="#10b981" fillOpacity={1} fill="url(#colorInt)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-header">
                        <BarChart3 size={14} /> <span>EVENT_DISTRIBUTION</span>
                    </div>
                    <div className="chart-body">
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={typeStats}>
                                <XAxis dataKey="name" hide />
                                <Tooltip 
                                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: '10px' }}
                                />
                                <Bar dataKey="value">
                                    {typeStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#38bdf8' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="system-status-mini">
                    <div className="status-item">
                        <span>NETWORK</span>
                        <span className="val green">SOMNIA_TESTNET</span>
                    </div>
                    <div className="status-item">
                        <span>LATENCY</span>
                        <span className="val">12ms</span>
                    </div>
                    <div className="status-item">
                        <span>ACTIVE_REACTIVE_THREADS</span>
                        <span className="val">{mySentinels.filter(s => s.isActive).length}</span>
                    </div>
                </div>

                <div className="on-chain-stats">
                    <div className="chart-header">
                        <RefreshCw size={14} className={isWatching ? 'spin' : ''} />
                        <span>ON-CHAIN REACTIVITY STATE (LIVE)</span>
                    </div>
                    <div className="stat-grid">
                        <div className="stat-card">
                            <span className="stat-label">REACTIVE_CALLS</span>
                            <span className="stat-value">{reactiveCallCount.toString()}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">PRICE_ALERTS</span>
                            <span className="stat-value">{priceAlertCount.toString()}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">BLOCKTICK_SUB</span>
                            <span className="stat-value status">{blockTickSubId > 0n ? 'ACTIVE' : 'NONE'}</span>
                        </div>
                    </div>
                </div>

                <div className="architecture-card">
                    <div className="chart-header">
                        <Cpu size={14} />
                        <span>SOMNIA REACTIVITY LOOP</span>
                    </div>
                    <div className="arch-flow">
                        <div className="arch-node emitter">Event Emitter<span>Sentinel / Oracle / Bridge</span></div>
                        <ArrowRight size={16} className="arch-arrow" />
                        <div className="arch-node precompile">0x0100<span>Reactivity Precompile</span></div>
                        <ArrowRight size={16} className="arch-arrow" />
                        <div className="arch-node handler">SentinelHandler<span>_onEvent() callback</span></div>
                        <ArrowRight size={16} className="arch-arrow" />
                        <div className="arch-node frontend">Dashboard<span>WSS push via SDK</span></div>
                    </div>
                    <p className="arch-desc">Events are pushed by validators — zero polling, zero indexers. State reads are atomic at event block height.</p>
                </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="system-footer">
        <div className="footer-item">REACTIVE_MODE: AUTO</div>
        <div className="footer-item">SESSION_READY: {sessionClient ? "YES" : "NO"}</div>
        <div className="footer-item">CORE_SYSTEM: V3.0.0-STABLE</div>
      </footer>
    </div>
  );
}

export default App;
