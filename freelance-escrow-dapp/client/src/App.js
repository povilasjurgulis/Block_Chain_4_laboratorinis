import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import FreelanceEscrowArtifact from "./contracts/FreelanceEscrow.json";
import { NETWORK_ID, CONTRACT_ADDRESS } from "./escrowConfig";


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
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Freelance Escrow DApp</h1>

      <div style={{ 
        padding: "10px", 
        marginBottom: "20px", 
        backgroundColor: isCorrectNetwork ? "#d4edda" : "#f8d7da",
        border: `1px solid ${isCorrectNetwork ? "#c3e6cb" : "#f5c6cb"}`,
        borderRadius: "5px"
      }}>
        <p style={{ margin: "5px 0" }}>
          <strong>Tinklas:</strong> {chainId ? `Chain ID: ${parseInt(chainId, 16)}` : "Nežinomas"}
          {isCorrectNetwork ? " " : " ❌ (Reikia 1337)"}
        </p>
        <p style={{ margin: "5px 0" }}>
          <strong>Contract adresas:</strong> {CONTRACT_ADDRESS}
        </p>
      </div>

      <p>
        Prisijungusi paskyra:{" "}
        {currentAccount ? (
          <strong>{currentAccount}</strong>
        ) : (
          <em>neprisijungta</em>
        )}
      </p>
      <button onClick={connectWallet}>Prisijungti per MetaMask</button>

      <hr />

      <h2>1. Sukurti darbą (Client)</h2>
      <form onSubmit={createJob}>
        <div>
          <label>Freelancer adresas:</label>
          <input
            type="text"
            value={freelancer}
            onChange={(e) => setFreelancer(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Arbitro adresas:</label>
          <input
            type="text"
            value={arbitrator}
            onChange={(e) => setArbitrator(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label>Suma (ETH):</label>
          <input
            type="text"
            value={amountEth}
            onChange={(e) => setAmountEth(e.target.value)}
          />
        </div>

        <button type="submit">Sukurti darbą</button>
      </form>

      <hr />

      <h2>2. Darbo valdymas</h2>
      <div>
        <label>Job ID:</label>
        <input
          type="text"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          style={{ width: "100px" }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={acceptJob}>Freelancer: priimti darbą</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={submitWork}>Freelancer: pateikti darbą</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={approveWork}>Client: patvirtinti darbą</button>
      </div>

      <hr />
      <p><strong>Statusas:</strong> {status}</p>
    </div>
  );
}

export default App;
