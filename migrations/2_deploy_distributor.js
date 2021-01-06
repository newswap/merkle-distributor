const MerkleDistributor = artifacts.require("MerkleDistributor")

module.exports = async function (deployer, network, accounts) {
  console.log("accounts[0]:"+accounts[0]);

  const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
  const maintainer = accounts[0]

  await deployer.deploy(MerkleDistributor, maintainer, ZERO_BYTES32);
  const distributor = await MerkleDistributor.deployed();
  console.log("distributor:" + distributor.address);

};

