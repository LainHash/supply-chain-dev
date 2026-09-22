/**
 * Manufacturer.test.js
 * Comprehensive unit tests for the Manufacturer contract.
 *
 * Coverage:
 *  - Deployment and initial state
 *  - register / addManufacturer (alias)
 *  - Duplicate registration rejection
 *  - Invalid input rejection
 *  - addRawProduct
 *  - updateRawProducts (parallel arrays)
 *  - getRawProductInfo
 *  - getManufacturer / getManufacturersList / getManufacturerRawProductDetails
 *  - launchProduct
 *  - verifyManufacturer / updateEnergy (admin only)
 *  - Events: ManufacturerRegistered, RawProductAdded, ProductLaunched, EnergyUpdated
 */

const { assert, expect } = require('chai');
const Manufacturer = artifacts.require('Manufacturer');

require('chai')
  .use(require('chai-as-promised'))
  .should();

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

  // ───────────────────────────────────────────────────────────────
  // Deployment
  // ───────────────────────────────────────────────────────────────

  describe('Deployment', () => {
    it('deploys successfully', async () => {
      assert.notEqual(manufacturerContract.address, '');
    });

    it('sets the deploying account as admin', async () => {
      assert.isTrue(await manufacturerContract.isAdmin(admin));
    });

    it('initial manufacturers list is empty', async () => {
      const list = await manufacturerContract.getManufacturersList();
      assert.equal(list.length, 0);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Registration
  // ───────────────────────────────────────────────────────────────

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

    it('registers a second manufacturer via register()', async () => {
      await manufacturerContract.register('Manufacturer 2', 'Location 2', 'manufacturer', { from: manufacturer2Addr });
      const { manufacturer } = await manufacturerContract.getManufacturer(manufacturer2Addr);
      assert.equal(manufacturer.name, 'Manufacturer 2');
    });

    it('rejects duplicate registration', async () => {
      await manufacturerContract.register('Dup', 'Location', 'manufacturer', { from: manufacturerAddress })
        .should.be.rejectedWith('already registered');
    });

    it('rejects empty name', async () => {
      await manufacturerContract.register('', 'Location', 'manufacturer', { from: accounts[5] })
        .should.be.rejectedWith('name cannot be empty');
    });

    it('rejects empty location', async () => {
      await manufacturerContract.register('Name', '', 'manufacturer', { from: accounts[6] })
        .should.be.rejectedWith('location cannot be empty');
    });

    it('emits ManufacturerRegistered event', async () => {
      const tx = await manufacturerContract.register('Mfr3', 'City3', 'manufacturer', { from: accounts[7] });
      const event = tx.logs.find(l => l.event === 'ManufacturerRegistered');
      assert.ok(event);
      assert.equal(event.args.id, accounts[7]);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Raw products
  // ───────────────────────────────────────────────────────────────

  describe('Raw products', () => {
    it('updateRawProducts updates products via parallel arrays', async () => {
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
      assert.property(products[0], 'name');
      assert.property(products[0], 'boughtFromIds');
      assert.property(products[0], 'isVerified');
    });

    it('addRawProduct emits RawProductAdded event', async () => {
      const suppliers = [{ id: farmerAddress, isVerified: false }];
      const tx = await manufacturerContract.addRawProduct('Sugar', suppliers, { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'RawProductAdded');
      assert.ok(event);
      assert.equal(event.args.name, 'Sugar');
    });

    it('addRawProduct rejects empty name', async () => {
      await manufacturerContract.addRawProduct('', [], { from: manufacturerAddress })
        .should.be.rejectedWith('name cannot be empty');
    });

    it('addRawProduct rejects if caller not registered', async () => {
      await manufacturerContract.addRawProduct('X', [], { from: accounts[8] })
        .should.be.rejectedWith('not registered as manufacturer');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Product lifecycle
  // ───────────────────────────────────────────────────────────────

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
      assert.ok(event);
      assert.equal(event.args.productId.toString(), '8888');
    });

    it('launchProduct rejects if caller not registered', async () => {
      await manufacturerContract.launchProduct(1111, { from: accounts[9] })
        .should.be.rejectedWith('not registered');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Verification (admin only)
  // ───────────────────────────────────────────────────────────────

  describe('Verification', () => {
    it('non-admin cannot verifyManufacturer', async () => {
      await manufacturerContract.verifyManufacturer(manufacturerAddress, { from: nonAdmin })
        .should.be.rejectedWith(Error);
    });

    it('admin verifyManufacturer sets isRenewableUsed = true', async () => {
      await manufacturerContract.verifyManufacturer(manufacturerAddress, { from: admin });
      const { isRenewableUsed } = await manufacturerContract.getManufacturer(manufacturerAddress);
      assert.isTrue(isRenewableUsed);
    });

    it('emits EnergyUpdated event on verifyManufacturer', async () => {
      const tx = await manufacturerContract.verifyManufacturer(manufacturer2Addr, { from: admin });
      const event = tx.logs.find(l => l.event === 'EnergyUpdated');
      assert.ok(event);
      assert.equal(event.args.manufacturer, manufacturer2Addr);
    });

    it('verifyManufacturer fails for unregistered address', async () => {
      await manufacturerContract.verifyManufacturer(accounts[9], { from: admin })
        .should.be.rejectedWith('not registered');
    });
  });
});