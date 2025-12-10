const FreelanceEscrow = artifacts.require("FreelanceEscrow");

module.exports = function (deployer) {
  deployer.deploy(FreelanceEscrow);
};