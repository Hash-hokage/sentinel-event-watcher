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
    blockNumber: number;
    receivedAt: number;
}

function App() {
  const [registryAddress, setRegistryAddress] = useState(REGISTRY_ADDRESS);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [mySentinels, setMySentinels] = useState<SentinelConfig[]>([]);
  const [allSentinels, setAllSentinels] = useState<SentinelConfig[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isWatching, setIsWatching] = useState(true);
  
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

  // Live Block Number
  const [blockNumber, setBlockNumber] = useState<bigint>(0n);

  // Copy to Clipboard
  const [copiedChip, setCopiedChip] = useState<string | null>(null);

  const publicClient = useMemo(() => createPublicClient({
    chain: somniaTestnet,
    transport: http()
  }), []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const block = await publicClient.getBlockNumber();
        setBlockNumber(block);
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [publicClient]);

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

  const copyToClipboard = (label: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedChip(label);
    setTimeout(() => setCopiedChip(null), 1500);
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      const walletClient = createWalletClient({ chain: somniaTestnet, transport: custom(window.ethereum) });
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
      setIsConnected(true);
    }
  };

  const initSession = async () => {
    try {
      const seed = sessionSeed || toHex(crypto.getRandomValues(new Uint8Array(32)));
      if (!sessionSeed) setSessionSeed(seed);
      const client = await createSessionClient({
        seed: seed as `0x${string}`,
        chain: somniaTestnet,
        transport: http(),
      });
      setSessionClient(client);
      const bal = await publicClient.getBalance({ address: client.account.address });
      setSessionBalance(formatEther(bal));
    } catch (err) {
      console.error('Session Init Error:', err);
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
                BigInt(newThreshold || '0'), 
                (actionTarget || '0x0000000000000000000000000000000000000000') as `0x${string}`, 
                (actionData || '0x') as `0x${string}`
            ],
            account
        });
        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        fetchSentinels();
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
          const hash = await walletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash });
          fetchSentinels();
      } catch (err) {
          console.error(err);
      }
  };

  const fetchAllSentinels = async () => {
    try {
      const total = await publicClient.readContract({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: [{ name: 'nextSentinelId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
        functionName: 'nextSentinelId',
      });
      const count = Number(total);
      if (count === 0) return;
      const cap = Math.min(count, 20);
      const configs = await Promise.all(
        Array.from({ length: cap }, (_, i) => i).map(async (i) => {
          const data = await publicClient.readContract({
            address: REGISTRY_ADDRESS as `0x${string}`,
            abi: REGISTRY_ABI,
            functionName: 'sentinels',
            args: [BigInt(i)],
          });
          return {
            id: BigInt(i),
            owner: data[0],
            sType: data[1],
            target: data[2],
            threshold: data[3],
            isActive: data[4],
            actionTarget: data[5],
            actionData: data[6],
          } as SentinelConfig;
        })
      );
      setAllSentinels(configs);
    } catch (err) {
      console.error('fetchAllSentinels error:', err);
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
    fetchAllSentinels();
  }, []);

  useEffect(() => {
    if (isConnected && registryAddress) fetchSentinels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, registryAddress, account]);

  useEffect(() => {
    if (!isWatching) return;
    let subscription: any;

    const systemSources = [HANDLER_ADDRESS, REGISTRY_ADDRESS, ORACLE_ADDRESS];
    const userTargets = mySentinels
      .filter(s => s.isActive)
      .map(s => s.target);
    const allSources = [...new Set([...systemSources, ...userTargets])];

    sdk.subscribe({
      eventContractSources: allSources,
      ethCalls: [],
      onData: async (data) => {
        const emitter = data.result.emitter.toLowerCase();
        const matchedSentinel = mySentinels.find(
          s => s.isActive && s.target.toLowerCase() === emitter
        );

        const newEvent: EventLog = {
          id: Date.now(),
          type: matchedSentinel?.actionTarget !== '0x0000000000000000000000000000000000000000'
            ? 'AUTO_REACTIVE_ACTION'
            : 'REACTIVE_SIGNAL',
          msg: `Signal from ${emitter.slice(0, 10)}... ${
            matchedSentinel?.actionTarget !== '0x0000000000000000000000000000000000000000'
              ? '-> EXECUTING ACTION'
              : ''
          }`,
          time: new Date().toLocaleTimeString(),
          emitter: data.result.emitter,
          blockNumber: Number(data.result.blockNumber ?? 0),
          receivedAt: Date.now(),
        };
        setEvents(prev => [newEvent, ...prev].slice(0, 50));

        if (
          matchedSentinel &&
          matchedSentinel.actionTarget !== '0x0000000000000000000000000000000000000000' &&
          sessionClient
        ) {
          try {
            const hash = await sessionClient.sendTransaction({
              to: matchedSentinel.actionTarget,
              data: matchedSentinel.actionData,
            });
            const actionEvent: EventLog = {
              id: Date.now() + 1,
              type: 'SESSION_TX_CONFIRMED',
              msg: `Action sent to ${matchedSentinel.actionTarget.slice(0, 10)}...`,
              time: new Date().toLocaleTimeString(),
              emitter: 'SESSION_ACCOUNT',
              blockNumber: 0,
              receivedAt: Date.now(),
            };
            setEvents(prev => [actionEvent, ...prev].slice(0, 50));
          } catch (err) {
            console.error('Automated Action Failed:', err);
          }
        }
      },
    }).then(sub => (subscription = sub));

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
            <button className="addr-pill" onClick={() => copyToClipboard('REG', REGISTRY_ADDRESS)} title={REGISTRY_ADDRESS}>
              {copiedChip === 'REG' ? 'COPIED ✓' : `REG: ${REGISTRY_ADDRESS.slice(0, 6)}...`}
            </button>
            <button className="addr-pill" onClick={() => copyToClipboard('HND', HANDLER_ADDRESS)} title={HANDLER_ADDRESS}>
              {copiedChip === 'HND' ? 'COPIED ✓' : `HND: ${HANDLER_ADDRESS.slice(0, 6)}...`}
            </button>
            <button className="addr-pill" onClick={() => copyToClipboard('ORC', ORACLE_ADDRESS)} title={ORACLE_ADDRESS}>
              {copiedChip === 'ORC' ? 'COPIED ✓' : `ORC: ${ORACLE_ADDRESS.slice(0, 6)}...`}
            </button>
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
            <h3>DISPOSABLE SESSION KEY</h3>
            <div className="input-group-row">
                <input 
                    type="text" 
                    placeholder="Leave empty to auto-generate" 
                    value={sessionSeed}
                    onChange={(e) => setSessionSeed(e.target.value)}
                />
                <button onClick={initSession} className="session-btn">
                    <Key size={14} /> {sessionClient ? "RLD" : "INIT"}
                </button>
            </div>
            <p className="session-disclaimer">
              ⚠ Auto-generated throwaway key — never enter your real wallet seed
            </p>
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
              {(() => {
                const displaySentinels = mySentinels.length > 0 ? mySentinels : allSentinels;
                return (
                  <>
                    <h3>ACTIVE_AGENTS ({displaySentinels.length})</h3>
                    <div className="sentinel-list">
                      {displaySentinels.map((s, idx) => (
                        <div key={idx} className={`sentinel-item ${s.isActive ? 'active' : 'inactive'}`}>
                          <span className={`active-dot ${s.isActive ? '' : 'inactive'}`} />
                          <div className="s-info">
                            <span className={`s-type badge ${
                              s.sType === 0 ? 'badge-wallet' :
                              s.sType === 1 ? 'badge-price' :
                              s.sType === 2 ? 'badge-system' :
                              'badge-bridge'
                            }`}>
                              {s.sType === 0 ? 'WAL' : s.sType === 1 ? 'PRI' : s.sType === 2 ? 'SYS' : 'BRG'}
                            </span>
                            <div className="s-details">
                              <span className="s-target">{s.target.slice(0, 10)}...</span>
                              {s.actionTarget !== '0x0000000000000000000000000000000000000000' && (
                                <span className="s-action-badge">AUTO</span>
                              )}
                            </div>
                          </div>
                          {mySentinels.some(ms => ms.id === s.id) && (
                            <button onClick={() => toggleSentinel(s.id)} className="toggle-icon">
                              <Power size={14} color={s.isActive ? "#10b981" : "#64748b"} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
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
                        <span className={`log-type ${
                          ev.type === 'AUTO_REACTIVE_ACTION' ? 'type-auto' :
                          ev.type === 'SESSION_TX_CONFIRMED' ? 'type-session' :
                          'type-signal'
                        }`}>{ev.type}</span>
                        <span className="log-time">{ev.time}</span>
                        {ev.blockNumber > 0 && (
                          <span className="log-block">⚡ block #{ev.blockNumber.toLocaleString()}</span>
                        )}
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
        <div className="footer-item">BLOCK: <span className="val green">#{blockNumber.toLocaleString()}</span></div>
        <div className="footer-item">SUBSCRIPTIONS: <span className={`val ${isWatching ? 'green' : ''}`}>{isWatching ? 'ACTIVE' : 'STANDBY'}</span></div>
        <div className="footer-item">CORE_SYSTEM: V3.0.0-STABLE</div>
      </footer>
    </div>
  );
}

export default App;
