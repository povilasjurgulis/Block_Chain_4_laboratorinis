import React, { useState } from "react";
import { ethers } from "ethers";
import FreelanceEscrowArtifact from "./contracts/FreelanceEscrow.json";
import { NETWORK_ID, CONTRACT_ADDRESS } from "./escrowConfig";

const networks = FreelanceEscrowArtifact.networks;

// surandam DIDŽIAUSIĄ network id (paskutinį, t.y. naujausią migrate)
// const NETWORK_ID = Math.max(
//   ...Object.keys(networks).map(Number)  // paverčiam string -> number
// ).toString();                           // ir atgal į string

// const CONTRACT_ADDRESS = networks[NETWORK_ID].address.toLowerCase();


function App() {
  const [currentAccount, setCurrentAccount] = useState(null);

  const [freelancer, setFreelancer] = useState("");
  const [arbitrator, setArbitrator] = useState("");
  const [amountEth, setAmountEth] = useState("0.1");

  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");

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
    } catch (err) {
      console.error(err);
    }
  }

  async function createJob(e) {
    e.preventDefault();
    try {
      const contract = await getContract();
      setStatus("Kuriamas darbas...");

      const tx = await contract.createJob(freelancer, arbitrator, {
        value: ethers.parseEther(amountEth),
      });

      await tx.wait();

      // Paprastumo dėlei laikom, kad pirmas darbas turi ID 0,
      // antras - 1 ir t.t. (kontrakte nextJobId++ nuo 0).
      setStatus("Darbas sukurtas! Pirmasis darbas turi ID 0.");
      setJobId("0");
    } catch (err) {
      console.error(err);
      setStatus("Klaida kuriant darbą. Žiūrėk konsolę.");
    }
  }

  async function acceptJob() {
    try {
      const contract = await getContract();
      setStatus("Freelancer priima darbą...");
      const tx = await contract.acceptJob(Number(jobId));
      await tx.wait();
      setStatus("Darbas priimtas!");
    } catch (err) {
      console.error(err);
      setStatus("Klaida acceptJob.");
    }
  }

  async function submitWork() {
    try {
      const contract = await getContract();
      setStatus("Pateikiamas atliktas darbas...");
      const tx = await contract.submitWork(Number(jobId));
      await tx.wait();
      setStatus("Darbas pateiktas (Submitted).");
    } catch (err) {
      console.error(err);
      setStatus("Klaida submitWork.");
    }
  }

  async function approveWork() {
    try {
      const contract = await getContract();
      setStatus("Užsakovas tvirtina darbą...");
      const tx = await contract.approveWork(Number(jobId));
      await tx.wait();
      setStatus("Darbas patvirtintas! Lėšos pervestos freelancer'iui.");
    } catch (err) {
      console.error(err);
      setStatus("Klaida approveWork.");
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Freelance Escrow DApp</h1>

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
