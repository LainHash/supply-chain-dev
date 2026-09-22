/**
 * Manufacturer.test.js
 * Comprehensive unit tests for the Manufacturer contract.
 * Uses plain chai (no chai-as-promised) for truffle compatibility.
 */

const { assert } = require('chai');
const Manufacturer = artifacts.require('Manufacturer');

async function shouldRevert(fn) {
  try {
    await fn();
    return false;
  } catch (e) {
    return true;
  }
}

contract('Manufacturer', (accounts) => {
  const admin               = accounts[0];
  const farmerAddress       = accounts[1];
  const manufacturerAddress = accounts[2];
  const manufacturer2Addr   = accounts[3];
  const nonAdmin            = accounts[4];
  let manufacturerContract;

  before(async () => {
    manufacturerContract = await Manufacturer.deployed();
  });

  // ─── Deployment ────────────────────────────────────────────────

  describe('Deployment', () => {
    it('deploys successfully', async () => {
      assert.notEqual(manufacturerContract.address, '');
    });

    it('sets deployer as admin', async () => {
      assert.isTrue(await manufacturerContract.isAdmin(admin));
    });

    it('initial manufacturers list is empty', async () => {
      const list = await manufacturerContract.getManufacturersList();
      assert.equal(list.length, 0);
    });
  });

  // ─── Registration ──────────────────────────────────────────────

  describe('Registration', () => {
    it('registers via addManufacturer()', async () => {
      await manufacturerContract.addManufacturer(
        'Manufacturer 1',
        ['Apple', 'Cocoa'],
        [farmerAddress, farmerAddress],
        { from: manufacturerAddress }
      );
      const { manufacturer } = await manufacturerContract.getManufacturer(manufacturerAddress);
      assert.equal(manufacturer.id, manufacturerAddress);
      assert.equal(manufacturer.name, 'Manufacturer 1');
    });

    it('getManufacturersList grows after registration', async () => {
      const list = await manufacturerContract.getManufacturersList();
      assert.isAbove(list.length, 0);
    });

    it('registers second manufacturer via register()', async () => {
      await manufacturerContract.register('Manufacturer 2', 'Location 2', 'manufacturer', { from: manufacturer2Addr });
      const { manufacturer } = await manufacturerContract.getManufacturer(manufacturer2Addr);
      assert.equal(manufacturer.name, 'Manufacturer 2');
    });

    it('rejects duplicate registration', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.register('Dup', 'Location', 'manufacturer', { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('rejects empty name', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.register('', 'Location', 'manufacturer', { from: accounts[5] })
      );
      assert.isTrue(reverted);
    });

    it('rejects empty location', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.register('Name', '', 'manufacturer', { from: accounts[6] })
      );
      assert.isTrue(reverted);
    });

    it('emits ManufacturerRegistered event', async () => {
      const tx = await manufacturerContract.register('Mfr3', 'City3', 'manufacturer', { from: accounts[7] });
      const event = tx.logs.find(l => l.event === 'ManufacturerRegistered');
      assert.ok(event, 'ManufacturerRegistered event not emitted');
      assert.equal(event.args.id, accounts[7]);
    });
  });

  // ─── Raw products ──────────────────────────────────────────────

  describe('Raw products', () => {
    it('Updating Manufacturer Raw Products via updateRawProducts()', async () => {
      await manufacturerContract.updateRawProducts(
        ['Cocoa', 'Milk'],
        [farmerAddress, farmerAddress],
        { from: manufacturerAddress }
      );
      const cocoa = await manufacturerContract.getRawProductInfo(manufacturerAddress, 'Cocoa');
      const milk  = await manufacturerContract.getRawProductInfo(manufacturerAddress, 'Milk');
      assert.equal(cocoa, farmerAddress);
      assert.equal(milk,  farmerAddress);
    });

    it('getManufacturerRawProductDetails returns rawProduct structs', async () => {
      const products = await manufacturerContract.getManufacturerRawProductDetails(manufacturerAddress);
      assert.isAbove(products.length, 0);
    });

    it('addRawProduct emits RawProductAdded event', async () => {
      const suppliers = [{ id: farmerAddress, isVerified: false }];
      const tx = await manufacturerContract.addRawProduct('Sugar', suppliers, { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'RawProductAdded');
      assert.ok(event, 'RawProductAdded event not emitted');
      assert.equal(event.args.name, 'Sugar');
    });

    it('addRawProduct rejects empty name', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.addRawProduct('', [], { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('addRawProduct rejects unregistered caller', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.addRawProduct('X', [], { from: accounts[8] })
      );
      assert.isTrue(reverted);
    });
  });

  // ─── Product lifecycle ─────────────────────────────────────────

  describe('launchProduct', () => {
    it('launchProduct records the product id', async () => {
      await manufacturerContract.launchProduct(9999, { from: manufacturerAddress });
      const { launchedProductIds } = await manufacturerContract.getManufacturer(manufacturerAddress);
      const ids = launchedProductIds.map(id => id.toString());
      assert.include(ids, '9999');
    });

    it('emits ProductLaunched event', async () => {
      const tx = await manufacturerContract.launchProduct(8888, { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductLaunched');
      assert.ok(event, 'ProductLaunched event not emitted');
      assert.equal(event.args.productId.toString(), '8888');
    });

    it('launchProduct rejects unregistered caller', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.launchProduct(1111, { from: accounts[9] })
      );
      assert.isTrue(reverted);
    });
  });

  // ─── Verification ──────────────────────────────────────────────

  describe('Manufacturer Verification', () => {
    it('only admin can verify Manufacturer (non-admin fails)', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.verifyManufacturer(manufacturerAddress, { from: nonAdmin })
      );
      assert.isTrue(reverted, 'Expected non-admin to fail');
    });

    it('Verifying Manufacturer sets isRenewableUsed = true', async () => {
      await manufacturerContract.verifyManufacturer(manufacturerAddress, { from: admin });
      const { isRenewableUsed } = await manufacturerContract.getManufacturer(manufacturerAddress);
      assert.isTrue(isRenewableUsed);
    });

    it('emits EnergyUpdated event on verifyManufacturer', async () => {
      const tx = await manufacturerContract.verifyManufacturer(manufacturer2Addr, { from: admin });
      const event = tx.logs.find(l => l.event === 'EnergyUpdated');
      assert.ok(event, 'EnergyUpdated event not emitted');
      assert.equal(event.args.manufacturer, manufacturer2Addr);
    });

    it('verifyManufacturer rejects unregistered address', async () => {
      const reverted = await shouldRevert(() =>
        manufacturerContract.verifyManufacturer(accounts[9], { from: admin })
      );
      assert.isTrue(reverted);
    });
  });
});