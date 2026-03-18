import { useState, useEffect, useMemo, useRef } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseAbiItem, Log } from 'viem';
import { localhost } from 'viem/chains';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Radio, Activity, Wallet, Terminal, AlertTriangle, Cpu, Globe } from 'lucide-react';
import './App.css';

const ALERT_EVENT_ABI = parseAbiItem("event AlertTriggered(address indexed sender, string indexed alertType, string message, uint256 timestamp)");

function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [events, setEvents] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const publicClient = useMemo(() => createPublicClient({
    chain: localhost,
    transport: window.ethereum ? custom(window.ethereum) : http()
  }), []);

  const connectWallet = async () => {
    if (window.ethereum) {
      const walletClient = createWalletClient({ chain: localhost, transport: custom(window.ethereum) });
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

  useEffect(() => {
    let unwatch: (() => void) | undefined;
    if (isWatching && contractAddress) {
      unwatch = publicClient.watchEvent({
        address: contractAddress as `0x${string}`,
        event: ALERT_EVENT_ABI,
        onLogs: (logs) => {
          setEvents(prev => [...logs, ...prev].slice(0, 50));
        }
      });
    }
    return () => unwatch?.();
  }, [isWatching, contractAddress, publicClient]);

  const triggerAlert = async () => {
    if (!account || !contractAddress) return;
    const walletClient = createWalletClient({ chain: localhost, transport: custom(window.ethereum!) });
    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: [{ type: 'function', name: 'triggerAlert', inputs: [{ type: 'string', name: 'alertType' }, { type: 'string', name: 'message' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'triggerAlert',
        args: ['THREAT_DETECTED', `System breach simulation initiated by ${account.slice(0,6)}`],
        account
      });
      await walletClient.writeContract(request);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sentinel-root">
      {/* Background Grids & Scanners */}
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
              <Wallet size={16} /> Connect System
            </button>
          )}
        </div>
      </nav>

      <main className="dashboard-grid">
        {/* Sidebar: Control Panel */}
        <aside className="control-panel">
          <div className="panel-header">
            <Terminal size={18} /> <h2>COMMAND_INPUT</h2>
          </div>
          <div className="input-container">
            <label>TARGET_CONTRACT_HEX</label>
            <input 
              type="text" 
              placeholder="0x000...000" 
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              disabled={isWatching}
            />
            <button 
              onClick={toggleWatching} 
              className={`watch-btn ${isWatching ? 'active' : ''}`}
            >
              {isWatching ? <><Radio size={16} className="spin" /> STOP_SCAN</> : 'INITIATE_SCAN'}
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
                <span className="status-online">ACTIVE_MONITORING</span>
              </div>
              <div className="stat-row">
                <span>LATENCY:</span>
                <span>12ms</span>
              </div>
              <div className="stat-row">
                <span>NETWORK:</span>
                <span>LOCAL_HOST_8545</span>
              </div>
            </motion.div>
          )}

          {isConnected && isWatching && (
            <button onClick={triggerAlert} className="inject-btn">
              <AlertTriangle size={16} /> INJECT_TEST_THREAT
            </button>
          )}
        </aside>

        {/* Main: Event Feed */}
        <section className="feed-container">
          <div className="feed-header">
            <div className="header-title">
              <Globe size={18} /> <h2>LIVE_THREAT_FEED</h2>
            </div>
            <div className="event-counter">{events.length} LOGS_CAPTURED</div>
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
                  <p>SYSTEM_IDLE: AWAITING_ENCRYPTED_SIGNALS...</p>
                </motion.div>
              ) : (
                events.map((ev, idx) => (
                  <motion.div 
                    key={`${ev.blockNumber}-${idx}`}
                    initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="log-entry"
                  >
                    <div className="log-meta">
                      <span className="log-type">{ev.args.alertType}</span>
                      <span className="log-time">{new Date(Number(ev.args.timestamp) * 1000).toLocaleTimeString()}</span>
                    </div>
                    <p className="log-msg">{ev.args.message}</p>
                    <div className="log-footer">
                      <span className="log-origin">ORIGIN: {ev.args.sender.slice(0, 16)}...</span>
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
        <div className="footer-item">CORE_VERSION: 0.33.2</div>
        <div className="footer-item">ENCRYPTION: AES_256_GCM</div>
        <div className="footer-item">SECURITY_LEVEL: OMEGA</div>
      </footer>
    </div>
  );
}

export default App;
