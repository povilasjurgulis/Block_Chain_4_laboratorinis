import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import FreelanceEscrowArtifact from "./contracts/FreelanceEscrow.json";
import { NETWORK_ID, CONTRACT_ADDRESS } from "./escrowConfig";
import "./App.css";

function App() {
  const [currentAccount, setCurrentAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  const [freelancer, setFreelancer] = useState("");
  const [arbitrator, setArbitrator] = useState("");
  const [amountEth, setAmountEth] = useState("0.1");

  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");

  const EXPECTED_CHAIN_ID = "0x539"; // 1337 in hex

  async function getContract() {
    if (!window.ethereum) {
      alert("Reikia MetaMask įskiepio.");
      throw new Error("MetaMask not found");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(
      CONTRACT_ADDRESS,
      FreelanceEscrowArtifact.abi,
      signer
    );
  }

  useEffect(() => {
    if (window.ethereum) {
      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setCurrentAccount(accounts[0]);
          setStatus("Paskyra pakeista: " + accounts[0]);
        } else {
          setCurrentAccount(null);
          setStatus("MetaMask atjungtas");
        }
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", (newChainId) => {
        setChainId(newChainId);
        setIsCorrectNetwork(newChainId === EXPECTED_CHAIN_ID);
        window.location.reload(); // Reload on chain change
      });

      // Check initial chain
      window.ethereum
        .request({ method: "eth_chainId" })
        .then((chainId) => {
          setChainId(chainId);
          setIsCorrectNetwork(chainId === EXPECTED_CHAIN_ID);
        });
    }
  }, []);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("Reikia MetaMask.");
        return;
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setCurrentAccount(accounts[0]);
      
      // Check if on correct network
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(currentChainId);
      
      if (currentChainId !== EXPECTED_CHAIN_ID) {
        setIsCorrectNetwork(false);
        setStatus(" Prašome perjungti į Ganache tinklą (Chain ID: 1337)");
        
        // Try to switch to Ganache network
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: EXPECTED_CHAIN_ID }],
          });
          setIsCorrectNetwork(true);
          setStatus("Prisijungta prie tinklo 1337");
        } catch (switchError) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: EXPECTED_CHAIN_ID,
                    chainName: "Ganache Local",
                    rpcUrls: ["http://127.0.0.1:8545"],
                    nativeCurrency: {
                      name: "Ether",
                      symbol: "ETH",
                      decimals: 18,
                    },
                  },
                ],
              });
              setIsCorrectNetwork(true);
              setStatus("Ganache tinklas pridėtas ir prisijungta");
            } catch (addError) {
              console.error(addError);
              setStatus("Nepavyko pridėti Ganache tinklo");
            }
          } else {
            console.error(switchError);
            setStatus("Nepavyko perjungti tinklo");
          }
        }
      } else {
        setIsCorrectNetwork(true);
        setStatus("Prisijungta prie tinklo 1337");
      }
    } catch (err) {
      console.error(err);
      setStatus("Klaida jungiantis: " + err.message);
    }
  }

  async function createJob(e) {
    e.preventDefault();
    
    if (!isCorrectNetwork) {
      setStatus(" Prašome perjungti į Ganache tinklą (Chain ID: 1337)");
      return;
    }
    
    try {
      const contract = await getContract();
      setStatus("Kuriamas darbas...");

      // Ensure amount is properly formatted
      const valueInWei = ethers.parseEther(amountEth.trim());
      
      const tx = await contract.createJob(freelancer, arbitrator, {
        value: valueInWei,
      });

      setStatus("Laukiama transakcijos patvirtinimo...");
      const receipt = await tx.wait();

      // Get the jobId from the event
      const jobCreatedEvent = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "JobCreated"
      );
      
      let newJobId = "0";
      if (jobCreatedEvent) {
        newJobId = jobCreatedEvent.args[0].toString();
      }
      
      setStatus(`Darbas sukurtas! Job ID: ${newJobId}`);
      setJobId(newJobId);
    } catch (err) {
      console.error(err);
      if (err.code === "INSUFFICIENT_FUNDS") {
        setStatus("❌ Nepakanka lėšų. Patikrinkite, ar paskyra turi pakankamai ETH.");
      } else if (err.code === "ACTION_REJECTED") {
        setStatus("Transakcija atmesta");
      } else {
        setStatus("Klaida: " + (err.message || "Žiūrėk konsolę"));
      }
    }
  }

  async function acceptJob() {
    if (!isCorrectNetwork) {
      setStatus(" Prašome perjungti į Ganache tinklą (Chain ID: 1337)");
      return;
    }
    
    try {
      const contract = await getContract();
      setStatus("Freelancer priima darbą...");
      const tx = await contract.acceptJob(Number(jobId));
      setStatus("Laukiama patvirtinimo...");
      await tx.wait();
      setStatus(" Darbas priimtas!");
    } catch (err) {
      console.error(err);
      if (err.code === "ACTION_REJECTED") {
        setStatus("Transakcija atmesta");
      } else {
        setStatus("Klaida: " + (err.message || "Žiūrėk konsolę"));
      }
    }
  }

  async function submitWork() {
    if (!isCorrectNetwork) {
      setStatus(" Prašome perjungti į Ganache tinklą (Chain ID: 1337)");
      return;
    }
    
    try {
      const contract = await getContract();
      setStatus("Pateikiamas atliktas darbas...");
      const tx = await contract.submitWork(Number(jobId));
      setStatus("Laukiama patvirtinimo...");
      await tx.wait();
      setStatus(" Darbas pateiktas (Submitted).");
    } catch (err) {
      console.error(err);
      if (err.code === "ACTION_REJECTED") {
        setStatus("Transakcija atmesta");
      } else {
        setStatus("Klaida: " + (err.message || "Žiūrėk konsolę"));
      }
    }
  }

  async function approveWork() {
    if (!isCorrectNetwork) {
      setStatus(" Prašome perjungti į Ganache tinklą (Chain ID: 1337)");
      return;
    }
    
    try {
      const contract = await getContract();
      setStatus("Užsakovas tvirtina darbą...");
      const tx = await contract.approveWork(Number(jobId));
      setStatus("Laukiama patvirtinimo...");
      await tx.wait();
      setStatus(" Darbas patvirtintas! Lėšos pervestos freelancer'iui.");
    } catch (err) {
      console.error(err);
      if (err.code === "ACTION_REJECTED") {
        setStatus("Transakcija atmesta");
      } else {
        setStatus("Klaida: " + (err.message || "Žiūrėk konsolę"));
      }
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Freelance Escrow DApp</h1>
        <p className="app-subtitle">Decentralized Freelance Payment Platform</p>
      </header>

      {/* Network Status Card */}
      <div className={`network-card ${isCorrectNetwork ? "network-success" : "network-error"}`}>
        <div className="network-header">
          <h3>Network Status</h3>
          <span className={`status-badge ${isCorrectNetwork ? "badge-success" : "badge-error"}`}>
            {isCorrectNetwork ? "CONNECTED" : "WRONG NETWORK"}
          </span>
        </div>
        <div className="network-info">
          <div className="info-row">
            <span className="info-label">Chain ID:</span>
            <span className="info-value">{chainId ? parseInt(chainId, 16) : "Unknown"}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Expected Chain ID:</span>
            <span className="info-value">1337 (Ganache Local)</span>
          </div>
          <div className="info-row">
            <span className="info-label">Contract Address:</span>
            <span className="info-value contract-address">{CONTRACT_ADDRESS}</span>
          </div>
        </div>
      </div>

      {/* Account Connection Card */}
      <div className="account-card">
        <div className="account-header">
          <h3>Account Connection</h3>
        </div>
        <div className="account-content">
          {currentAccount ? (
            <div className="connected-account">
              <span className="account-label">Connected Account:</span>
              <span className="account-address">{currentAccount}</span>
            </div>
          ) : (
            <p className="not-connected">No wallet connected</p>
          )}
          <button className="btn btn-primary btn-large" onClick={connectWallet}>
            {currentAccount ? "Switch Account" : "Connect MetaMask Wallet"}
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="cards-grid">
        
        {/* Client Card - Create Job */}
        <div className="action-card card-client">
          <div className="card-header">
            <h2 className="card-title">Client Panel</h2>
            <span className="role-badge badge-client">CLIENT</span>
          </div>
          <div className="card-body">
            <p className="card-description">
              Create a new escrow job by specifying the freelancer, arbitrator, and payment amount.
            </p>
            <form onSubmit={createJob} className="job-form">
              <div className="form-group">
                <label className="form-label">Freelancer Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={freelancer}
                  onChange={(e) => setFreelancer(e.target.value)}
                  placeholder="0x..."
                  required
                  pattern="0x[a-fA-F0-9]{40}"
                  title="Valid Ethereum address required (0x...)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Arbitrator Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={arbitrator}
                  onChange={(e) => setArbitrator(e.target.value)}
                  placeholder="0x..."
                  required
                  pattern="0x[a-fA-F0-9]{40}"
                  title="Valid Ethereum address required (0x...)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Amount (ETH) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={amountEth}
                  onChange={(e) => setAmountEth(e.target.value)}
                  placeholder="0.1"
                  step="0.001"
                  min="0.001"
                  required
                />
              </div>

              <button type="submit" className="btn btn-success btn-block">
                Create Escrow Job
              </button>
            </form>
          </div>
        </div>

        {/* Freelancer Card */}
        <div className="action-card card-freelancer">
          <div className="card-header">
            <h2 className="card-title">Freelancer Panel</h2>
            <span className="role-badge badge-freelancer">FREELANCER</span>
          </div>
          <div className="card-body">
            <p className="card-description">
              Accept assigned jobs and submit completed work for client approval.
            </p>
            
            <div className="form-group">
              <label className="form-label">Job ID *</label>
              <input
                type="number"
                className="form-input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="0"
                min="0"
                required
              />
            </div>

            <div className="button-group">
              <button 
                className="btn btn-info btn-block" 
                onClick={acceptJob}
                disabled={!jobId}
              >
                Accept Job
              </button>
              <button 
                className="btn btn-warning btn-block" 
                onClick={submitWork}
                disabled={!jobId}
              >
                Submit Work
              </button>
            </div>
          </div>
        </div>

        {/* Client Approval Card */}
        <div className="action-card card-arbiter">
          <div className="card-header">
            <h2 className="card-title">Client Approval</h2>
            <span className="role-badge badge-arbiter">APPROVAL</span>
          </div>
          <div className="card-body">
            <p className="card-description">
              Review and approve completed work to release payment to the freelancer.
            </p>
            
            <div className="form-group">
              <label className="form-label">Job ID *</label>
              <input
                type="number"
                className="form-input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="0"
                min="0"
                required
              />
            </div>

            <button 
              className="btn btn-primary btn-block" 
              onClick={approveWork}
              disabled={!jobId}
            >
              Approve Work & Release Payment
            </button>
          </div>
        </div>

      </div>

      {/* Status Card */}
      {status && (
        <div className={`status-card ${
          status.includes("sukurtas") || status.includes("priimtas") || status.includes("pateiktas") || status.includes("patvirtintas") || status.includes("Prisijungta") 
            ? "status-success" 
            : status.includes("Klaida") || status.includes("atmesta") || status.includes("Nepavyko")
            ? "status-error"
            : "status-info"
        }`}>
          <div className="status-header">
            <h3>Transaction Status</h3>
          </div>
          <div className="status-body">
            <p className="status-message">{status}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>Powered by Ethereum Smart Contracts | Truffle + Ganache + React</p>
      </footer>
    </div>
  );
}

export default App;
