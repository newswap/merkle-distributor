// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.6.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract MerkleDistributor is Ownable {
    using SafeMath for uint256;

    address public maintainer;

    // the merkle root of the merkle tree containing account total rewards to claim.
    bytes32 public merkleRoot;

    // claimed amount of each user.
    mapping(address => uint256) public claimedAmount;

    // This event is triggered whenever a call to #claim succeeds.
    event Claimed(uint256 index, address account, uint256 amount);

    constructor(address _maintainer, bytes32 _merkleRoot) public {
        maintainer = _maintainer;
        merkleRoot = _merkleRoot;
    }

    modifier onlyMaintainer() {
        require(maintainer == msg.sender, "onlyMaintainer: caller is not the maintainer");
        _;
    }

    ///////////////////////////////////////////////////
    //            function for Owner                 //
    ///////////////////////////////////////////////////
    
    function setMaintainer(address _maintainer) public onlyOwner {
        maintainer = _maintainer;   
    }

    // Withdraw New. EMERGENCY ONLY.
    function emergencyWithdrawNew(address payable _to) public onlyOwner {
        Address.sendValue(_to, address(this).balance);
    }

    ///////////////////////////////////////////////////
    //       function for Maintainer                 //
    ///////////////////////////////////////////////////

    function setMerkleRoot(bytes32 _merkleRoot) public onlyMaintainer {
        merkleRoot = _merkleRoot;
    }

    ///////////////////////////////////////////////////
    //       function for Miner                      //
    ///////////////////////////////////////////////////

    function claim(uint256 _index, address payable _account, uint256 _amount, bytes32[] calldata _merkleProof) public { 
        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(_index, _account, _amount));
        require(MerkleProof.verify(_merkleProof, merkleRoot, node), 'MerkleDistributor: Invalid proof.');

        uint256 pending = _amount.sub(claimedAmount[_account]);
        if(pending > 0) {
            claimedAmount[_account] = _amount;
            Address.sendValue(_account, pending);
        }   

        emit Claimed(_index, _account, pending);
    }

    receive () external payable { }
}
