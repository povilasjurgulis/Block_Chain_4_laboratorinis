module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1337",      // Match Ganache chainId
      gas: 6721975,            // Gas limit
      gasPrice: 20000000000,   // 20 gwei
    },
  },

  // Set default mocha options
  mocha: {
    // timeout: 100000
  },

  // Configure compilers
  compilers: {
    solc: {
      version: "0.8.20",
    },
  },
};
