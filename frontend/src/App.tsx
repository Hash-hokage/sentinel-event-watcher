import { useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, parseAbiItem } from 'viem';
import { localhost } from 'viem/chains';
import './App.css';

const SENTINEL_ABI = [
  "event AlertTriggered(address indexed sender, string indexed alertType, string message, uint256 timestamp)",
  "function triggerAlert(string alertType, string message) external"
] as const;

function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<`0x${string}`>();
  const [events, setEvents] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);

  // Initialize client
  const publicClient = createPublicClient({
    chain: localhost,
    transport: window.ethereum ? custom(window.ethereum) : http()
  });

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

  const startWatching = () => {
    if (!contractAddress || !contractAddress.startsWith('0x')) {
      alert("Please enter a valid contract address starting with 0x");
      return;
    }
    setIsWatching(true);
    setEvents([]); // clear previous
    
    // In a real app you should store the unwatch function and clean it up on unmount
    publicClient.watchEvent({
      address: contractAddress as `0x${string}`,
      event: parseAbiItem("event AlertTriggered(address indexed sender, string indexed alertType, string message, uint256 timestamp)"),
      onLogs: (logs) => {
        setEvents(prev => [...logs, ...prev]);
      }
    });
  };

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
            {!isWatching ? (
               <button onClick={startWatching} className="primary-btn">Start Watching</button>
            ) : (
               <span className="status-badge watching">🟢 Watching Active</span>
            )}
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
              <p className="no-events">No alerts detected yet. Waiting for on-chain events...</p>
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
