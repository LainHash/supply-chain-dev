/**
 * Product.test.js
 * Comprehensive unit tests for the Product contract.
 *
 * Coverage:
 *  - Deployment and initial state
 *  - add() / addProduct() (alias)
 *  - Duplicate product ID rejection
 *  - get() / getProduct() (alias)
 *  - transfer() / updateOwnership() (alias)
 *  - Only current owner can transfer
 *  - addReview()
 *  - Only current owner can add review
 *  - Product History: getProductHistory()
 *    - Created on add()
 *    - Added on transfer()
 *    - Added on addReview()
 *  - Events: ProductCreated, ProductTransferred, ProductReviewed, ProductHistoryAdded
 *  - Reverted transactions leave no state change
 */

const { assert, expect } = require('chai');
const Product = artifacts.require('Product');

require('chai')
  .use(require('chai-as-promised'))
  .should();

contract('Product', (accounts) => {
  const admin              = accounts[0];
  const manufacturerAddress = accounts[1];
  const distributerAddress  = accounts[2];
  const consumerAddress     = accounts[3];
  const notOwner            = accounts[4];
  let productContract;

  const productId     = 123456;          // matches test's "123456"
  const productId2    = 654321;
  const productTitle  = 'Product 1';

  before(async () => {
    productContract = await Product.deployed();
  });

  // ───────────────────────────────────────────────────────────────
  // Deployment
  // ───────────────────────────────────────────────────────────────

  describe('Deployment', () => {
    it('deploys successfully', async () => {
      assert.notEqual(productContract.address, '');
    });

    it('initial product count is 0', async () => {
      const count = await productContract.getProductsCount();
      assert.equal(count.toString(), '0');
    });

    it('initial transaction count is 0', async () => {
      const count = await productContract.getTransactionsCount();
      assert.equal(count.toString(), '0');
    });

    it('initial review count is 0', async () => {
      const count = await productContract.getReviewsCount();
      assert.equal(count.toString(), '0');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // getProduct (non-existent)
  // ───────────────────────────────────────────────────────────────

  describe('getProduct – non-existent', () => {
    it(`returns isValue=false for non-existent product ${productId}`, async () => {
      const product = await productContract.getProduct(productId);
      assert.isFalse(product.isValue);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Adding products
  // ───────────────────────────────────────────────────────────────

  describe('addProduct / add', () => {
    it(`adds product with serialNo ${productId}`, async () => {
      await productContract.addProduct(productId, productTitle, ['Cocoa', 'Milk'], { from: manufacturerAddress });
      const product = await productContract.getProduct(productId);
      assert.isTrue(product.isValue);
      assert.equal(product.ownership, manufacturerAddress);
    });

    it('product count increases after addProduct', async () => {
      const count = await productContract.getProductsCount();
      assert.equal(count.toString(), '1');
    });

    it('get() returns full product data', async () => {
      const { item, rawProducts } = await productContract.get(productId);
      assert.equal(item.id.toString(), productId.toString());
      assert.equal(item.title, productTitle);
      assert.equal(rawProducts.length, 2);
    });

    it('rejects duplicate product id', async () => {
      await productContract.addProduct(productId, 'Dup', ['X'], { from: manufacturerAddress })
        .should.be.rejectedWith('already exists');
    });

    it('rejects empty title', async () => {
      await productContract.addProduct(999, '', ['X'], { from: manufacturerAddress })
        .should.be.rejectedWith('title cannot be empty');
    });

    it('emits ProductCreated event', async () => {
      const tx = await productContract.addProduct(productId2, 'Product 2', ['Y'], { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductCreated');
      assert.ok(event);
      assert.equal(event.args.id.toString(), productId2.toString());
      assert.equal(event.args.title, 'Product 2');
      assert.equal(event.args.manufacturer, manufacturerAddress);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Ownership / transfer
  // ───────────────────────────────────────────────────────────────

  describe('Product Ownership', () => {
    it('only current owner can transfer (updateOwnership)', async () => {
      await productContract.updateOwnership(distributerAddress, productId, { from: notOwner })
        .should.be.rejectedWith('not the current owner');
    });

    it('cannot transfer to self', async () => {
      await productContract.transfer(manufacturerAddress, productId, { from: manufacturerAddress })
        .should.be.rejectedWith('cannot transfer to self');
    });

    it('cannot transfer to zero address', async () => {
      await productContract.transfer('0x0000000000000000000000000000000000000000', productId, { from: manufacturerAddress })
        .should.be.rejectedWith('cannot transfer to zero address');
    });

    it('transfers ownership to distributor via updateOwnership()', async () => {
      await productContract.updateOwnership(distributerAddress, productId, { from: manufacturerAddress });
      const product = await productContract.getProduct(productId);
      assert.equal(product.ownership.toLowerCase(), distributerAddress.toLowerCase());
    });

    it('transaction count increases after transfer', async () => {
      const count = await productContract.getTransactionsCount();
      assert.equal(count.toString(), '1');
    });

    it('transfers ownership to consumer via transfer()', async () => {
      await productContract.transfer(consumerAddress, productId, { from: distributerAddress });
      const product = await productContract.getProduct(productId);
      assert.equal(product.ownership.toLowerCase(), consumerAddress.toLowerCase());
    });

    it('emits ProductTransferred event', async () => {
      // Transfer product2 from manufacturer to distributer
      const tx = await productContract.transfer(distributerAddress, productId2, { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductTransferred');
      assert.ok(event);
      assert.equal(event.args.id.toString(), productId2.toString());
      assert.equal(event.args.from, manufacturerAddress);
      assert.equal(event.args.to, distributerAddress);
    });

    it('get() includes transfer transactions', async () => {
      const { transactions } = await productContract.get(productId);
      assert.isAbove(transactions.length, 0);
      assert.equal(transactions[0].from, manufacturerAddress);
      assert.equal(transactions[0].to, distributerAddress);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Reviews
  // ───────────────────────────────────────────────────────────────

  describe('Reviews', () => {
    it('only current owner can add review', async () => {
      // consumer is current owner of productId
      await productContract.addReview(productId, 80, 'Great', { from: manufacturerAddress })
        .should.be.rejectedWith('not the current owner');
    });

    it('rejects rating above 100', async () => {
      await productContract.addReview(productId, 101, 'Bad', { from: consumerAddress })
        .should.be.rejectedWith('rating must be 0-100');
    });

    it('adds a review from current owner', async () => {
      await productContract.addReview(productId, 80, 'Good product', { from: consumerAddress });
      const count = await productContract.getReviewsCount();
      assert.equal(count.toString(), '1');
    });

    it('get() includes reviews', async () => {
      const { reviews } = await productContract.get(productId);
      assert.equal(reviews.length, 1);
      assert.equal(reviews[0].rating.toString(), '80');
      assert.equal(reviews[0].comment, 'Good product');
    });

    it('emits ProductReviewed event', async () => {
      const tx = await productContract.addReview(productId, 60, 'OK', { from: consumerAddress });
      const event = tx.logs.find(l => l.event === 'ProductReviewed');
      assert.ok(event);
      assert.equal(event.args.id.toString(), productId.toString());
      assert.equal(event.args.reviewer, consumerAddress);
      assert.equal(event.args.rating.toString(), '60');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Product History
  // ───────────────────────────────────────────────────────────────

  describe('Product History', () => {
    it('history is populated after addProduct', async () => {
      const history = await productContract.getProductHistory(productId);
      assert.isAbove(history.length, 0);
    });

    it('first history record is CREATED', async () => {
      const history = await productContract.getProductHistory(productId);
      const created = history.find(h => h.action === 'CREATED');
      assert.ok(created);
      assert.equal(created.actor, manufacturerAddress);
    });

    it('history includes TRANSFERRED records', async () => {
      const history = await productContract.getProductHistory(productId);
      const transfers = history.filter(h => h.action === 'TRANSFERRED');
      assert.isAbove(transfers.length, 0);
    });

    it('history includes REVIEWED records', async () => {
      const history = await productContract.getProductHistory(productId);
      const reviews = history.filter(h => h.action === 'REVIEWED');
      assert.isAbove(reviews.length, 0);
    });

    it('history records have correct timestamp (non-zero)', async () => {
      const history = await productContract.getProductHistory(productId);
      history.forEach(h => {
        assert.isAbove(parseInt(h.timestamp), 0);
      });
    });

    it('emits ProductHistoryAdded event on creation', async () => {
      const tx = await productContract.addProduct(11111, 'Hist Test', ['Z'], { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductHistoryAdded');
      assert.ok(event);
      assert.equal(event.args.action, 'CREATED');
    });

    it('getProductHistory rejects for non-existent product', async () => {
      await productContract.getProductHistory(99999)
        .should.be.rejectedWith('does not exist');
    });

    it('history is append-only - count grows monotonically', async () => {
      const before = (await productContract.getProductHistory(productId)).length;
      await productContract.addReview(productId, 50, 'Another review', { from: consumerAddress });
      const after = (await productContract.getProductHistory(productId)).length;
      assert.isAbove(after, before);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Revert safety (no partial state)
  // ───────────────────────────────────────────────────────────────

  describe('Revert safety', () => {
    it('failed addProduct leaves product count unchanged', async () => {
      const before = (await productContract.getItemIds()).length;
      try {
        await productContract.addProduct(productId, 'Dup', ['X'], { from: manufacturerAddress });
      } catch (_) {}
      const after = (await productContract.getItemIds()).length;
      assert.equal(before, after);
    });

    it('failed transfer leaves ownership unchanged', async () => {
      const before = await productContract.getProduct(productId);
      try {
        await productContract.transfer(notOwner, productId, { from: notOwner });
      } catch (_) {}
      const after = await productContract.getProduct(productId);
      assert.equal(before.ownership, after.ownership);
    });
  });
});