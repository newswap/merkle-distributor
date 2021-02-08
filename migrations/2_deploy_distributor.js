const MerkleDistributor = artifacts.require("MerkleDistributor")

module.exports = async function (deployer, network, accounts) {
  // console.log("accounts[0]:"+accounts[0]);
  // console.log("accounts[1]:"+accounts[1]);
  // console.log("accounts[2]:"+accounts[2]);

  // const maintainer = "0x999e1B44a6702a169e631d399C43a442fAdB51D9"
  // const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

  // await deployer.deploy(MerkleDistributor, maintainer, ZERO_BYTES32);
  // const distributor = await MerkleDistributor.deployed();
  // console.log("distributor:" + distributor.address);
  // console.log("merkleRoot:"+ await distributor.merkleRoot())
  // console.log("maintainer:" + await distributor.maintainer())



  // testnet: 0xF8D9dc9BcD3E6bcbFDbd0F1132043BD0Ee730ae5
  // devnet: 0x8F5f9f59c39F9Cb8D353CB25B8A0BD58e710cAa5
  // const distributor = await MerkleDistributor.at("0x8F5f9f59c39F9Cb8D353CB25B8A0BD58e710cAa5");
  // console.log("merkleRoot:"+ await distributor.merkleRoot())
  // console.log("maintainer:" + await distributor.maintainer())
  // const index = 0
  // const account = "0x0fb8eeda0139ee6F40d34C031D95D07f92f8e2Aa"
  // const amount = "3000000000000000000000"
  // // testnet每5分钟会变一次
  // const proof = ["0xce03f98b4dae60242d8243781b4d959105701f8b483fd802ffdd85bb6785693e", "0x39036f547b31094006927e149e5be25b1a9be471b94a86084f64553b79f7bc3c", "0xf1ec1ef36ad9516ef063f92fd82ae7294aef40b6fdfb3587bdbf56985ba20434"]

  // console.log("merkleRoot claimed:"+ (await distributor.claimedAmount(account))/1e18)
  // const tx = await distributor.claim(index, account, amount, proof)
  // console.log(tx)
  // console.log(tx.logs[0])
  // console.log("merkleRoot:"+ (await distributor.claimedAmount(account))/1e18)

};

