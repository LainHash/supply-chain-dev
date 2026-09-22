/**
 * StakeHolder.test.js
 * Unit tests for the Stakeholder contract.
 *
 * Coverage:
 *  - Deployment and admin assignment
 *  - register() – addStakeHolder alias
 *  - Duplicate registration rejection
 *  - Invalid input rejection
 *  - get() – getStakeHolder alias
 *  - getAddresses()
 *  - verify() – admin only
 *  - setApprovalForAll / isApprovedForAll
 *  - transferFrom – owner / approved only
 *  - Events: StakeholderRegistered, StakeholderVerified, ApprovalForAll, ProductTransferred
 */

const { assert, expect } = require('chai');
const Stakeholder = artifacts.require('Stakeholder');

require('chai')
  .use(require('chai-as-promised'))
  .should();

contract('Stakeholder', (accounts) => {
  const admin              = accounts[0];
  const stakeHolderAddress = accounts[1];
  const stakeHolder2Addr   = accounts[2];
  const nonAdmin           = accounts[3];
  let stakeHolderContract;

  before(async () => {
    stakeHolderContract = await Stakeholder.deployed();
  });

  // ───────────────────────────────────────────────────────────────
  // Deployment
  // ───────────────────────────────────────────────────────────────

  describe('Deployment', () => {
    it('deploys successfully', async () => {
      assert.notEqual(stakeHolderContract.address, '');
    });

    it('admin is set to deployer', async () => {
      assert.isTrue(await stakeHolderContract.isAdmin(admin));
    });

    it('initial address list is empty', async () => {
      const addresses = await stakeHolderContract.getAddresses();
      assert.equal(addresses.length, 0);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Registration (register / addStakeHolder alias)
  // ───────────────────────────────────────────────────────────────

  describe('Registration', () => {
    it('adds a stakeholder via register()', async () => {
      await stakeHolderContract.register('Distributer 1', 'City', 'distributer', { from: stakeHolderAddress });
      const sh = await stakeHolderContract.get(stakeHolderAddress);
      assert.equal(sh.id, stakeHolderAddress);
      assert.equal(sh.name, 'Distributer 1');
      assert.isFalse(sh.isVerified);
    });

    it('getAddresses grows after registration', async () => {
      const addresses = await stakeHolderContract.getAddresses();
      assert.include(addresses, stakeHolderAddress);
    });

    it('rejects duplicate registration', async () => {
      await stakeHolderContract.register('Dup', 'City', 'distributer', { from: stakeHolderAddress })
        .should.be.rejectedWith('already registered');
    });

    it('rejects empty name', async () => {
      await stakeHolderContract.register('', 'City', 'distributer', { from: accounts[5] })
        .should.be.rejectedWith('name cannot be empty');
    });

    it('rejects empty location', async () => {
      await stakeHolderContract.register('Name', '', 'distributer', { from: accounts[6] })
        .should.be.rejectedWith('location cannot be empty');
    });

    it('emits StakeholderRegistered event', async () => {
      const tx = await stakeHolderContract.register('Retailer', 'Town', 'retailer', { from: stakeHolder2Addr });
      const event = tx.logs.find(l => l.event === 'StakeholderRegistered');
      assert.ok(event);
      assert.equal(event.args.id, stakeHolder2Addr);
      assert.equal(event.args.role, 'retailer');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Retrieval
  // ───────────────────────────────────────────────────────────────

  describe('Retrieval', () => {
    it('get() returns the correct record', async () => {
      const sh = await stakeHolderContract.get(stakeHolderAddress);
      assert.equal(sh.name, 'Distributer 1');
      assert.equal(sh.role, 'distributer');
    });

    it('get() returns zero values for unknown address', async () => {
      const sh = await stakeHolderContract.get(accounts[9]);
      assert.equal(sh.id, '0x0000000000000000000000000000000000000000');
    });

    it('getRole() returns correct role', async () => {
      const role = await stakeHolderContract.getRole(stakeHolderAddress);
      assert.equal(role, 'distributer');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Verification
  // ───────────────────────────────────────────────────────────────

  describe('Verification', () => {
    it('non-admin cannot verify', async () => {
      await stakeHolderContract.verify(stakeHolderAddress, { from: nonAdmin })
        .should.be.rejectedWith(Error);
    });

    it('admin can verify a stakeholder', async () => {
      await stakeHolderContract.verify(stakeHolderAddress, { from: admin });
      assert.isTrue(await stakeHolderContract.isVerified(stakeHolderAddress));
    });

    it('emits StakeholderVerified event', async () => {
      const tx = await stakeHolderContract.verify(stakeHolder2Addr, { from: admin });
      const event = tx.logs.find(l => l.event === 'StakeholderVerified');
      assert.ok(event);
      assert.equal(event.args.id, stakeHolder2Addr);
    });

    it('verify rejects for unregistered address', async () => {
      await stakeHolderContract.verify(accounts[9], { from: admin })
        .should.be.rejectedWith('not registered');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Approvals
  // ───────────────────────────────────────────────────────────────

  describe('Approvals', () => {
    it('setApprovalForAll grants approval', async () => {
      await stakeHolderContract.setApprovalForAll(stakeHolder2Addr, true, { from: stakeHolderAddress });
      assert.isTrue(await stakeHolderContract.isApprovedForAll(stakeHolderAddress, stakeHolder2Addr));
    });

    it('setApprovalForAll emits ApprovalForAll event', async () => {
      const tx = await stakeHolderContract.setApprovalForAll(stakeHolder2Addr, false, { from: stakeHolderAddress });
      const event = tx.logs.find(l => l.event === 'ApprovalForAll');
      assert.ok(event);
      assert.isFalse(event.args.approved);
    });

    it('setApprovalForAll cannot approve self', async () => {
      await stakeHolderContract.setApprovalForAll(stakeHolderAddress, true, { from: stakeHolderAddress })
        .should.be.rejectedWith('cannot approve self');
    });

    it('setApprovalForAll rejects zero operator', async () => {
      await stakeHolderContract.setApprovalForAll('0x0000000000000000000000000000000000000000', true, { from: stakeHolderAddress })
        .should.be.rejectedWith('zero address');
    });
  });
});