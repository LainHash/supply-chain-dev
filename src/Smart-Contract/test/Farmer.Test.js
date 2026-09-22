/**
 * Farmer.Test.js
 * Comprehensive unit tests for the Farmer contract.
 *
 * Uses only chai (no chai-as-promised) for compatibility with
 * the truffle test environment.
 *
 * Coverage:
 *  - Deployment and initial state
 *  - addFarmer / registerFarmer / register
 *  - Duplicate registration rejection
 *  - Invalid input rejection
 *  - getFarmer / getFarmersList / getRawProductFarmers
 *  - addRawProduct
 *  - verifyFarmer (admin only)
 *  - Events
 */

const { assert } = require('chai');
const Farmer = artifacts.require('Farmer');

async function shouldRevert(fn) {
  try {
    await fn();
    return false;
  } catch (e) {
    return true;
  }
}

contract('Farmer', (accounts) => {
  const admin          = accounts[0];
  const farmerAddress  = accounts[1];
  const farmer2Address = accounts[2];
  const nonAdmin       = accounts[3];
  let farmerContract;

  before(async () => {
    farmerContract = await Farmer.deployed();
  });

  // ─── Deployment ────────────────────────────────────────────────

  describe('Deployment', () => {
    it('deploys successfully', async () => {
      assert.notEqual(farmerContract.address, '');
      assert.notEqual(farmerContract.address, '0x0');
    });

    it('sets deployer as admin', async () => {
      assert.isTrue(await farmerContract.isAdmin(admin));
    });

    it('initial farmer list is empty', async () => {
      const list = await farmerContract.getFarmersList();
      assert.equal(list.length, 0);
    });
  });

  // ─── Registration ──────────────────────────────────────────────

  describe('Registration', () => {
    it('registers a farmer via addFarmer()', async () => {
      await farmerContract.addFarmer('Farmer1', 'South India', ['Milk', 'Cocoa'], { from: farmerAddress });
      const { farmer } = await farmerContract.getFarmer(farmerAddress);
      assert.equal(farmer.id, farmerAddress);
      assert.equal(farmer.name, 'Farmer1');
    });

    it('getFarmer returns isVerified=false after registration', async () => {
      const { farmer } = await farmerContract.getFarmer(farmerAddress);
      assert.isFalse(farmer.isVerified);
    });

    it('getFarmersList grows after registration', async () => {
      const list = await farmerContract.getFarmersList();
      assert.isAbove(list.length, 0);
    });

    it('getFarmer returns correct raw products', async () => {
      const { rawProducts } = await farmerContract.getFarmer(farmerAddress);
      assert.equal(rawProducts.length, 2);
      assert.equal(rawProducts[0], 'Milk');
      assert.equal(rawProducts[1], 'Cocoa');
    });

    it('registers a second farmer via registerFarmer()', async () => {
      await farmerContract.registerFarmer('Farmer2', 'North India', 'farmer', ['Rice', 'Wheat'], { from: farmer2Address });
      const { farmer } = await farmerContract.getFarmer(farmer2Address);
      assert.equal(farmer.name, 'Farmer2');
    });

    it('rejects duplicate registration', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.addFarmer('Dup', 'Location', ['X'], { from: farmerAddress })
      );
      assert.isTrue(reverted, 'Expected duplicate registration to revert');
    });

    it('rejects empty name', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.addFarmer('', 'Location', ['X'], { from: accounts[5] })
      );
      assert.isTrue(reverted, 'Expected empty name to revert');
    });

    it('rejects empty location', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.addFarmer('Name', '', ['X'], { from: accounts[6] })
      );
      assert.isTrue(reverted, 'Expected empty location to revert');
    });

    it('emits FarmerRegistered event', async () => {
      const tx = await farmerContract.addFarmer('Farmer3', 'East India', ['Sugar'], { from: accounts[7] });
      const event = tx.logs.find(l => l.event === 'FarmerRegistered');
      assert.ok(event, 'FarmerRegistered event not emitted');
      assert.equal(event.args.id, accounts[7]);
      assert.equal(event.args.name, 'Farmer3');
    });
  });

  // ─── Raw products ──────────────────────────────────────────────

  describe('Raw products', () => {
    it('addRawProduct adds a new product', async () => {
      await farmerContract.addRawProduct('Banana', { from: farmerAddress });
      const { rawProducts } = await farmerContract.getFarmer(farmerAddress);
      assert.include(rawProducts, 'Banana');
    });

    it('addRawProduct rejects empty name', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.addRawProduct('', { from: farmerAddress })
      );
      assert.isTrue(reverted);
    });

    it('addRawProduct rejects duplicate raw product', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.addRawProduct('Milk', { from: farmerAddress })
      );
      assert.isTrue(reverted);
    });

    it('emits FarmerRawProductAdded event', async () => {
      const tx = await farmerContract.addRawProduct('Apple', { from: farmerAddress });
      const event = tx.logs.find(l => l.event === 'FarmerRawProductAdded');
      assert.ok(event, 'FarmerRawProductAdded event not emitted');
      assert.equal(event.args.farmer, farmerAddress);
      assert.equal(event.args.rawProduct, 'Apple');
    });

    it('getRawProductFarmers returns farmers for a raw product', async () => {
      const farmers = await farmerContract.getRawProductFarmers('Milk');
      assert.include(farmers, farmerAddress);
    });
  });

  // ─── Verification ──────────────────────────────────────────────

  describe('Farmer Verification', () => {
    it('only admin can verify farmer (non-admin fails)', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.verifyFarmer(farmerAddress, { from: nonAdmin })
      );
      assert.isTrue(reverted, 'Expected non-admin to fail');
    });

    it('admin can verifyFarmer', async () => {
      await farmerContract.verifyFarmer(farmerAddress, { from: admin });
      const { farmer } = await farmerContract.getFarmer(farmerAddress);
      assert.isTrue(farmer.isVerified);
    });

    it('isVerified() returns true after verification', async () => {
      assert.isTrue(await farmerContract.isVerified(farmerAddress));
    });

    it('emits StakeholderVerified event', async () => {
      const tx = await farmerContract.verifyFarmer(farmer2Address, { from: admin });
      const event = tx.logs.find(l => l.event === 'StakeholderVerified');
      assert.ok(event, 'StakeholderVerified event not emitted');
      assert.equal(event.args.id, farmer2Address);
    });

    it('verify() fails for unregistered address', async () => {
      const reverted = await shouldRevert(() =>
        farmerContract.verify(accounts[9], { from: admin })
      );
      assert.isTrue(reverted);
    });
  });
});