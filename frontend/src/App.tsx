import { useState, useEffect, useMemo } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseAbiItem, Log } from 'viem';
import { localhost } from 'viem/chains';
import './App.css';

const ALERT_EVENT_ABI = parseAbiItem("event AlertTriggered(address indexed sender, string indexed alertType, string message, uint256 timestamp)");

function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [events, setEvents] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);

  // 1. Memoize the client so it isn't recreated on every single React render
  const publicClient = useMemo(() => createPublicClient({
    chain: localhost,
    transport: window.ethereum ? custom(window.ethereum) : http()
  }), []);

  const connectWallet = async () => {
    if (window.ethereum) {
      const walletClient = createWalletClient({
        chain: localhost,
        transport: custom(window.ethereum)
      });
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
      setIsConnected(true);
    } else {
      alert("Please install a Web3 Wallet (like MetaMask) to interact!");
    }
  };

  const toggleWatching = () => {
    if (!isWatching) {
      if (!contractAddress || !contractAddress.startsWith('0x')) {
        alert("Please enter a valid contract address starting with 0x");
        return;
      }
      setEvents([]); // Clear previous events when starting fresh
      setIsWatching(true);
    } else {
      setIsWatching(false); // This will trigger the useEffect cleanup
    }
  };

  // 2. True Reactivity: Manage the subscription lifecycle with useEffect
  useEffect(() => {
    let unwatch: (() => void) | undefined;

    // Only subscribe when we are explicitly watching and have an address
    if (isWatching && contractAddress) {
      unwatch = publicClient.watchEvent({
        address: contractAddress as `0x${string}`,
        event: ALERT_EVENT_ABI,
        onLogs: (logs) => {
          // Reactively update the state array based on the previous state
          setEvents(prev => [...logs, ...prev]);
        }
      });
    }

    // 3. Cleanup: When dependencies change or component unmounts, unsubscribe
    return () => {
      if (unwatch) {
        unwatch();
      }
    };
  }, [isWatching, contractAddress, publicClient]);

  const triggerAlert = async () => {
    if (!account || !contractAddress) return;
    
    const walletClient = createWalletClient({
      chain: localhost,
      transport: custom(window.ethereum!)
    });

    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: [{
          type: 'function',
          name: 'triggerAlert',
          inputs: [{ type: 'string', name: 'alertType' }, { type: 'string', name: 'message' }],
          outputs: [],
          stateMutability: 'nonpayable',
        }],
        functionName: 'triggerAlert',
        args: ['SECURITY', 'Manual trigger from Sentinel UI'],
        account
      });
      
      const hash = await walletClient.writeContract(request);
      console.log('Transaction sent:', hash);
    } catch (err) {
      console.error(err);
      alert("Failed to trigger alert. Check the console for details.");
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🛡️ Sentinel Event Watcher</h1>
        {!isConnected ? (
          <button onClick={connectWallet} className="connect-btn">Connect Wallet</button>
        ) : (
          <div className="account-badge">Connected: {account?.slice(0,6)}...{account?.slice(-4)}</div>
        )}
      </header>

      <main className="main-content">
        <section className="config-section">
          <h2>Configuration</h2>
          <div className="input-group">
            <input 
              type="text" 
              placeholder="0x... Sentinel Contract Address" 
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              disabled={isWatching}
            />
            <button 
              onClick={toggleWatching} 
              className={!isWatching ? "primary-btn" : "danger-btn"}
            >
              {!isWatching ? "Start Watching" : "Stop Watching"}
            </button>
          </div>
          
          {isWatching && isConnected && (
            <div className="action-group">
               <button onClick={triggerAlert} className="danger-btn">Trigger Test Alert</button>
            </div>
          )}
        </section>

        <section className="events-section">
          <h2>Live Alerts Feed ({events.length})</h2>
          <div className="events-list">
            {events.length === 0 ? (
              <p className="no-events">
                {!isWatching ? "Enter a contract address and start watching..." : "No alerts detected yet. Waiting for on-chain events..."}
              </p>
            ) : (
              events.map((ev, idx) => (
                <div key={idx} className="event-card">
                  <div className="event-header">
                    <span className="alert-type">{ev.args.alertType}</span>
                    <span className="timestamp">{new Date(Number(ev.args.timestamp) * 1000).toLocaleString()}</span>
                  </div>
                  <p className="event-message">{ev.args.message}</p>
                  <p className="event-sender">From: {ev.args.sender}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
