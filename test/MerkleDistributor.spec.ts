import chai, { expect } from 'chai'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { Contract, BigNumber, constants, utils } from 'ethers'
import BalanceTree from '../src/balance-tree'

import Distributor from '../build/MerkleDistributor.json'
import { parseBalanceMap } from '../src/parse-balance-map'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const ONE__BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000001'

describe('MerkleDistributor', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })

  const wallets = provider.getWallets()
  const [wallet0, wallet1, wallet2] = wallets

  describe('#owner', () => {
    it('set correct state variables', async () => {
      const distributor = await deployContract(wallet0, Distributor, [wallet1.address, ZERO_BYTES32], overrides)
      expect(await distributor.maintainer()).to.eq(wallet1.address)
      expect(await distributor.merkleRoot()).to.eq(ZERO_BYTES32)
    })

    it('set new maintainer', async () => {
      const distributor = await deployContract(wallet0, Distributor, [wallet1.address, ZERO_BYTES32], overrides)
      await expect(distributor.connect(wallet1).setMaintainer(wallet2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      await distributor.connect(wallet0).setMaintainer(wallet2.address)
      expect(await distributor.maintainer()).to.eq(wallet2.address)
    })

    it('emergency withdraw New', async () => {
      const distributor = await deployContract(wallet0, Distributor, [wallet1.address, ZERO_BYTES32], overrides)
      await wallet0.sendTransaction({to: distributor.address, value: 200})
      expect((await provider.getBalance(distributor.address)).toNumber()).to.eq(200)

      await expect(distributor.connect(wallet1).emergencyWithdrawNew(wallet2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      
      const balanceBefore = await provider.getBalance(wallet2.address)
      // console.log(utils.formatEther(await provider.getBalance(wallet2.address)))
      await distributor.emergencyWithdrawNew(wallet2.address)
      expect((await provider.getBalance(distributor.address)).toNumber()).to.eq(0)
      const balanceAfter = await provider.getBalance(wallet2.address)
      expect((balanceAfter.sub(balanceBefore))).to.eq(200)
    })
  })

  describe('#Maintainer', () => {
    it('set new merkleRoot', async () => {
      const distributor = await deployContract(wallet0, Distributor, [wallet1.address, ZERO_BYTES32], overrides)
      expect(await distributor.maintainer()).to.eq(wallet1.address)
      expect(await distributor.merkleRoot()).to.eq(ZERO_BYTES32)

      await expect(distributor.connect(wallet0).setMerkleRoot(ONE__BYTES32)).to.be.revertedWith(
        'onlyMaintainer: caller is not the maintainer'
      )
      await distributor.connect(wallet1).setMerkleRoot(ONE__BYTES32)
      expect(await distributor.merkleRoot()).to.eq(ONE__BYTES32)
    })
  })

  describe('#claim', () => {
    it('fails for empty proof', async () => {
      const distributor = await deployContract(wallet0, Distributor, [wallet1.address, ZERO_BYTES32], overrides)
      await expect(distributor.claim(0, wallet0.address, 10, [])).to.be.revertedWith(
        'MerkleDistributor: Invalid proof.'
      )
    })

    it('fails for invalid index', async () => {
      const distributor = await deployContract(wallet0, Distributor, [wallet1.address, ZERO_BYTES32], overrides)
      await expect(distributor.claim(0, wallet0.address, 10, [])).to.be.revertedWith(
        'MerkleDistributor: Invalid proof.'
      )
    })

    describe('two account tree', () => {
      let distributor: Contract
      let tree: BalanceTree
      beforeEach('deploy', async () => {
        tree = new BalanceTree([
          { account: wallet0.address, amount: BigNumber.from(100) },
          { account: wallet1.address, amount: BigNumber.from(101) },
          { account: wallet2.address, amount: BigNumber.from(1) },   
        ])
        distributor = await deployContract(wallet0, Distributor, [wallet1.address, tree.getHexRoot()], overrides)
        await wallet2.sendTransaction({to: distributor.address, value: 201})
      })

      it('successful claim', async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        await expect(distributor.claim(0, wallet0.address, 100, proof0, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(0, wallet0.address, 100)
        const proof1 = tree.getProof(1, wallet1.address, BigNumber.from(101))
        await expect(distributor.claim(1, wallet1.address, 101, proof1, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(1, wallet1.address, 101)
      })

      it('transfers new', async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        const balanceBefore = await provider.getBalance(wallet0.address)
        await distributor.connect(wallet2).claim(0, wallet0.address, 100, proof0, overrides)
        const balanceAfter = await provider.getBalance(wallet0.address)
        expect((balanceAfter.sub(balanceBefore))).to.eq(100)
        expect((await distributor.claimedAmount(wallet0.address))).to.eq(100)

        const proof1 = tree.getProof(1, wallet1.address, BigNumber.from(101))
        const balanceBefore1 = await provider.getBalance(wallet1.address)
        await distributor.connect(wallet2).claim(1, wallet1.address, 101, proof1, overrides)
        const balanceAfter1 = await provider.getBalance(wallet1.address)
        expect((balanceAfter1.sub(balanceBefore1))).to.eq(101)
        expect((await distributor.claimedAmount(wallet1.address))).to.eq(101)

        expect((await provider.getBalance(distributor.address))).to.eq(0)
      })

      it('must have enough to transfer', async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        await distributor.claim(0, wallet0.address, 100, proof0, overrides)

        expect((await provider.getBalance(distributor.address)).toNumber()).to.eq(101)
        await distributor.emergencyWithdrawNew(wallet2.address)
        expect((await provider.getBalance(distributor.address)).toNumber()).to.eq(0)

        const proof1 = tree.getProof(1, wallet1.address, BigNumber.from(101))
        await expect(distributor.claim(1, wallet1.address, 101, proof1, overrides)).to.be.revertedWith(
          'Address: insufficient balance'
        )
        expect((await distributor.claimedAmount(wallet1.address))).to.eq(0)
      })

      it('allow two claims', async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        await distributor.claim(0, wallet0.address, 100, proof0, overrides)
        expect((await distributor.claimedAmount(wallet0.address))).to.eq(100)

        await expect(distributor.claim(0, wallet0.address, 100, proof0, overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(0, wallet0.address, 0)
      })

      it('multiple claims after update merkleRoot', async () => {
        const balanceBefore = await provider.getBalance(wallet0.address)
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        await expect(distributor.connect(wallet2).claim(0, wallet0.address, 100, proof0, overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(0, wallet0.address, 100)
        expect((await distributor.claimedAmount(wallet0.address))).to.eq(100)

        const tree2 = new BalanceTree([
          { account: wallet1.address, amount: BigNumber.from(101) },
          { account: wallet0.address, amount: BigNumber.from(150) },
          { account: wallet2.address, amount: BigNumber.from(1) },   
        ])
        await distributor.connect(wallet1).setMerkleRoot(tree2.getHexRoot())
        const proof0_1 = tree2.getProof(1, wallet0.address, BigNumber.from(150))
        await expect(distributor.connect(wallet2).claim(1, wallet0.address, 150, proof0_1, overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(1, wallet0.address, 50)
        expect((await distributor.claimedAmount(wallet0.address))).to.eq(150)

        const tree3 = new BalanceTree([
          { account: wallet0.address, amount: BigNumber.from(200) },
          { account: wallet1.address, amount: BigNumber.from(101) },
          { account: wallet2.address, amount: BigNumber.from(1) },   
        ])
        await distributor.connect(wallet1).setMerkleRoot(tree3.getHexRoot())
        const proof0_2 = tree3.getProof(0, wallet0.address, BigNumber.from(200))
        await expect(distributor.connect(wallet2).claim(0, wallet0.address, 200, proof0_2, overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(0, wallet0.address, 50)
        expect((await distributor.claimedAmount(wallet0.address))).to.eq(200)

        const balanceAfter = await provider.getBalance(wallet0.address)
        expect((balanceAfter.sub(balanceBefore))).to.eq(200)

        const proof2 = tree3.getProof(2, wallet2.address, BigNumber.from(1))
        await expect(distributor.claim(2, wallet2.address, 1, proof2, overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(2, wallet2.address, 1)

        expect((await provider.getBalance(distributor.address))).to.eq(0)
        const proof1 = tree3.getProof(1, wallet1.address, BigNumber.from(101))
        await expect(distributor.claim(1, wallet1.address, 101, proof1, overrides)).to.be.revertedWith(
          'Address: insufficient balance'
        )
      })

      it('amount is zero claim more than once: 0 and then 1', async () => {
        await distributor.claim(
          0,
          wallet0.address,
          100,
          tree.getProof(0, wallet0.address, BigNumber.from(100)),
          overrides
        )
        await distributor.claim(
          1,
          wallet1.address,
          101,
          tree.getProof(1, wallet1.address, BigNumber.from(101)),
          overrides
        )

        await expect(distributor.claim(0, wallet0.address, 100, tree.getProof(0, wallet0.address, BigNumber.from(100)), overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(0, wallet0.address, 0)
      })

      it('cannot claim more than once: 1 and then 0', async () => {
        await distributor.claim(
          1,
          wallet1.address,
          101,
          tree.getProof(1, wallet1.address, BigNumber.from(101)),
          overrides
        )
        await distributor.claim(
          0,
          wallet0.address,
          100,
          tree.getProof(0, wallet0.address, BigNumber.from(100)),
          overrides
        )

        await expect(distributor.claim(1, wallet1.address, 101, tree.getProof(1, wallet1.address, BigNumber.from(101)), overrides))
        .to.emit(distributor, 'Claimed')
        .withArgs(1, wallet1.address, 0)
      })

      it('cannot claim for address other than proof', async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        await expect(distributor.claim(1, wallet1.address, 101, proof0, overrides)).to.be.revertedWith(
          'MerkleDistributor: Invalid proof.'
        )
      })

      it('cannot claim more than proof', async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100))
        await expect(distributor.claim(0, wallet0.address, 101, proof0, overrides)).to.be.revertedWith(
          'MerkleDistributor: Invalid proof.'
        )
      })

      it('gas', async () => {
        const proof = tree.getProof(0, wallet0.address, BigNumber.from(100))
        const tx = await distributor.claim(0, wallet0.address, 100, proof, overrides)
        const receipt = await tx.wait()
        // console.log("receipt.gasUsed:"+receipt.gasUsed + "\n new:" + ((parseInt(receipt.gasUsed) * 500000000000000)/1e18))
        expect(receipt.gasUsed).to.eq(54967)   
      })
    })
    describe('larger tree', () => {
      let distributor: Contract
      let tree: BalanceTree
      beforeEach('deploy', async () => {
        tree = new BalanceTree(
          wallets.map((wallet, ix) => {
            return { account: wallet.address, amount: BigNumber.from(ix + 1) }
          })
        )
        distributor = await deployContract(wallet0, Distributor, [wallet1.address, tree.getHexRoot()], overrides)
        await wallet2.sendTransaction({to: distributor.address, value: 201})
      })

      it('claim index 4', async () => {
        const proof = tree.getProof(4, wallets[4].address, BigNumber.from(5))
        await expect(distributor.claim(4, wallets[4].address, 5, proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(4, wallets[4].address, 5)
      })

      it('claim index 9', async () => {
        const proof = tree.getProof(9, wallets[9].address, BigNumber.from(10))
        await expect(distributor.claim(9, wallets[9].address, 10, proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(9, wallets[9].address, 10)
      })

      it('gas', async () => {
        const proof = tree.getProof(9, wallets[9].address, BigNumber.from(10))
        const tx = await distributor.claim(9, wallets[9].address, 10, proof, overrides)
        const receipt = await tx.wait()
        // console.log("receipt.gasUsed:"+receipt.gasUsed + "\n new:" + ((parseInt(receipt.gasUsed) * 500000000000000)/1e18))
        expect(receipt.gasUsed).to.eq(57461)
      })

      it('gas second down about 15k', async () => {
        await distributor.claim(
          0,
          wallets[0].address,
          1,
          tree.getProof(0, wallets[0].address, BigNumber.from(1)),
          overrides
        )
        const tx = await distributor.claim(
          1,
          wallets[1].address,
          2,
          tree.getProof(1, wallets[1].address, BigNumber.from(2)),
          overrides
        )
        const receipt = await tx.wait()
        // console.log("receipt.gasUsed:"+receipt.gasUsed + "\n new:" + ((parseInt(receipt.gasUsed) * 500000000000000)/1e18))
        expect(receipt.gasUsed).to.eq(57441)
      })
    })

    describe('realistic size tree', () => {
      let distributor: Contract
      let tree: BalanceTree
      const NUM_LEAVES = 100_000
      const NUM_SAMPLES = 25
      const elements: { account: string; amount: BigNumber }[] = []
      for (let i = 0; i < NUM_LEAVES; i++) {
        // 真实tree不允许account重复       
        const node = { account: utils.formatBytes32String(""+i).substring(0, 42), amount: BigNumber.from(100) }
        elements.push(node)
      }
      tree = new BalanceTree(elements)

      it('proof verification works', () => {
        const root = Buffer.from(tree.getHexRoot().slice(2), 'hex')
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = tree
            .getProof(i, utils.formatBytes32String(""+i).substring(0, 42), BigNumber.from(100))
            .map((el) => Buffer.from(el.slice(2), 'hex'))
          const validProof = BalanceTree.verifyProof(i, utils.formatBytes32String(""+i).substring(0, 42), BigNumber.from(100), proof, root)
          expect(validProof).to.be.true
        }
      })

      beforeEach('deploy', async () => {
        distributor = await deployContract(wallet0, Distributor, [wallet1.address, tree.getHexRoot()], overrides)
        await wallet2.sendTransaction({to: distributor.address, value: 100000*100})
      })

      it('gas', async () => {
        const proof = tree.getProof(50000, utils.formatBytes32String("50000").substring(0, 42), BigNumber.from(100))
        const tx = await distributor.claim(50000, utils.formatBytes32String("50000").substring(0, 42), 100, proof, overrides)
        expect((await provider.getBalance(utils.formatBytes32String("50000").substring(0, 42))).toNumber()).to.eq(100)
        // const receipt = await tx.wait()
        // console.log("receipt.gasUsed:"+receipt.gasUsed + "\n new:" + ((parseInt(receipt.gasUsed) * 500000000000000)/1e18))
        // expect(receipt.gasUsed).to.eq(91650)
      })
      it('gas deeper node', async () => {
        const proof = tree.getProof(90000, utils.formatBytes32String("90000").substring(0, 42), BigNumber.from(100))
        const tx = await distributor.claim(90000, utils.formatBytes32String("90000").substring(0, 42), 100, proof, overrides)
        // const receipt = await tx.wait()
        // console.log("receipt.gasUsed:"+receipt.gasUsed + "\n new:" + ((parseInt(receipt.gasUsed) * 500000000000000)/1e18))
        // expect(receipt.gasUsed).to.eq(91586)
      })
      it('gas average random distribution', async () => {
        let total: BigNumber = BigNumber.from(0)
        let count: number = 0
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = tree.getProof(i, utils.formatBytes32String(""+i).substring(0, 42), BigNumber.from(100))
          const tx = await distributor.claim(i, utils.formatBytes32String(""+i).substring(0, 42), 100, proof, overrides)
          expect((await provider.getBalance(utils.formatBytes32String(""+i).substring(0, 42))).toNumber()).to.eq(100)
          // const receipt = await tx.wait()
          // total = total.add(receipt.gasUsed)
          // count++
        }
        // const average = total.div(count)
        // expect(average).to.eq(77075)
      })
      // this is what we gas golfed by packing the bitmap
      it('gas average first 25', async () => {
        let total: BigNumber = BigNumber.from(0)
        let count: number = 0
        for (let i = 0; i < 25; i++) {
          const proof = tree.getProof(i, utils.formatBytes32String(""+i).substring(0, 42), BigNumber.from(100))
          const tx = await distributor.claim(i, utils.formatBytes32String(""+i).substring(0, 42), 100, proof, overrides)
          // const receipt = await tx.wait()
          // total = total.add(receipt.gasUsed)
          // count++
        }
        // const average = total.div(count)
        // expect(average).to.eq(62824)
      })

      // it('no double claims in random distribution', async () => {
      //   for (let i = 0; i < 25; i += Math.floor(Math.random() * (NUM_LEAVES / NUM_SAMPLES))) {
      //     const proof = tree.getProof(i, wallet0.address, BigNumber.from(100))
      //     await distributor.claim(i, wallet0.address, 100, proof, overrides)
      //     await expect(distributor.claim(i, wallet0.address, 100, proof, overrides)).to.be.revertedWith(
      //       'MerkleDistributor: Drop already claimed.'
      //     )
      //   }
      // })
    })
  })

  describe('parseBalanceMap', () => {
    let distributor: Contract
    let claims: {
      [account: string]: {
        index: number
        amount: string
        proof: string[]
      }
    }
    beforeEach('deploy', async () => {
      const { claims: innerClaims, merkleRoot, tokenTotal } = parseBalanceMap({
        [wallet0.address]: 200,
        [wallet1.address]: 300,
        [wallet2.address]: 250,
      })
      expect(tokenTotal).to.eq('0x02ee') // 750
      claims = innerClaims
      distributor = await deployContract(wallet0, Distributor, [wallet1.address, merkleRoot], overrides)
      await wallet0.sendTransaction({to: distributor.address, value: tokenTotal})
    })

    it('check the proofs is as expected', () => {
      expect(claims).to.deep.eq({
        [wallet0.address]: {
          index: 0,
          amount: '0xc8',
          proof: ['0x2a411ed78501edb696adca9e41e78d8256b61cfac45612fa0434d7cf87d916c6'],
        },
        [wallet1.address]: {
          index: 1,
          amount: '0x012c',
          proof: [
            '0xbfeb956a3b705056020a3b64c540bff700c0f6c96c55c0a5fcab57124cb36f7b',
            '0xd31de46890d4a77baeebddbd77bf73b5c626397b73ee8c69b51efe4c9a5a72fa',
          ],
        },
        [wallet2.address]: {
          index: 2,
          amount: '0xfa',
          proof: [
            '0xceaacce7533111e902cc548e961d77b23a4d8cd073c6b68ccf55c62bd47fc36b',
            '0xd31de46890d4a77baeebddbd77bf73b5c626397b73ee8c69b51efe4c9a5a72fa',
          ],
        },
      })
    })

    it('all claims work exactly once', async () => {
      for (let account in claims) {
        const claim = claims[account]
        await expect(distributor.claim(claim.index, account, claim.amount, claim.proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(claim.index, account, claim.amount)
        await expect(distributor.claim(claim.index, account, claim.amount, claim.proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(claim.index, account, 0)
      }
      expect((await provider.getBalance(distributor.address))).to.eq(0)
    })
  })
})
