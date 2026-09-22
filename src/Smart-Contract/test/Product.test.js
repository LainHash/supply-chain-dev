/**
 * Product.test.js
 * Comprehensive unit tests for the Product contract.
 * Uses plain chai (no chai-as-promised) for truffle compatibility.
 */

const { assert } = require('chai');
const Product = artifacts.require('Product');

async function shouldRevert(fn) {
  try {
    await fn();
    return false;
  } catch (e) {
    return true;
  }
}

contract('Product', (accounts) => {
  const admin               = accounts[0];
  const manufacturerAddress = accounts[1];
  const distributerAddress  = accounts[2];
  const consumerAddress     = accounts[3];
  const notOwner            = accounts[4];
  let productContract;

  // productSerialNo as number (uint256)
  const productId    = 123456;
  const productId2   = 654321;
  const productTitle = 'Product 1';

  before(async () => {
    productContract = await Product.deployed();
  });

  // ─── Deployment ────────────────────────────────────────────────

  describe('Deployment', () => {
    it('deploys successfully', async () => {
      assert.notEqual(productContract.address, '');
    });

    it('initial product count is 0', async () => {
      assert.equal((await productContract.getProductsCount()).toString(), '0');
    });

    it('initial transaction count is 0', async () => {
      assert.equal((await productContract.getTransactionsCount()).toString(), '0');
    });

    it('initial review count is 0', async () => {
      assert.equal((await productContract.getReviewsCount()).toString(), '0');
    });
  });

  // ─── getProduct (non-existent) ─────────────────────────────────

  describe('getProduct - non-existent', () => {
    it(`returns isValue=false for product ${productId}`, async () => {
      const product = await productContract.getProduct(productId);
      assert.isFalse(product.isValue);
    });
  });

  // ─── Adding products ───────────────────────────────────────────

  describe('addProduct / add', () => {
    it(`Adding Product with serialNo: ${productId}`, async () => {
      await productContract.addProduct(productId, productTitle, ['Cocoa', 'Milk'], { from: manufacturerAddress });
      const product = await productContract.getProduct(productId);
      assert.isTrue(product.isValue);
      assert.equal(product.ownership.toLowerCase(), manufacturerAddress.toLowerCase());
    });

    it('product count increases', async () => {
      assert.equal((await productContract.getProductsCount()).toString(), '1');
    });

    it('get() returns full product data', async () => {
      const { item, rawProducts } = await productContract.get(productId);
      assert.equal(item.id.toString(), productId.toString());
      assert.equal(item.title, productTitle);
      assert.equal(rawProducts.length, 2);
    });

    it('rejects duplicate product id', async () => {
      const reverted = await shouldRevert(() =>
        productContract.addProduct(productId, 'Dup', ['X'], { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('rejects empty title', async () => {
      const reverted = await shouldRevert(() =>
        productContract.addProduct(999, '', ['X'], { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('emits ProductCreated event', async () => {
      const tx = await productContract.addProduct(productId2, 'Product 2', ['Y'], { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductCreated');
      assert.ok(event, 'ProductCreated event not emitted');
      assert.equal(event.args.id.toString(), productId2.toString());
      assert.equal(event.args.title, 'Product 2');
      assert.equal(event.args.manufacturer, manufacturerAddress);
    });
  });

  // ─── Ownership / transfer ──────────────────────────────────────

  describe('Product Ownership', () => {
    it('only current owner can update ownership', async () => {
      const reverted = await shouldRevert(() =>
        productContract.updateOwnership(distributerAddress, productId, { from: notOwner })
      );
      assert.isTrue(reverted, 'Expected unauthorized transfer to revert');
    });

    it('cannot transfer to self', async () => {
      const reverted = await shouldRevert(() =>
        productContract.transfer(manufacturerAddress, productId, { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('cannot transfer to zero address', async () => {
      const reverted = await shouldRevert(() =>
        productContract.transfer('0x0000000000000000000000000000000000000000', productId, { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('Updating Ownership to distributer', async () => {
      await productContract.updateOwnership(distributerAddress, productId, { from: manufacturerAddress });
      const product = await productContract.getProduct(productId);
      assert.equal(product.ownership.toLowerCase(), distributerAddress.toLowerCase());
    });

    it('transaction count increases', async () => {
      assert.isAbove(parseInt((await productContract.getTransactionsCount()).toString()), 0);
    });

    it('Updating Ownership to consumer', async () => {
      await productContract.updateOwnership(consumerAddress, productId, { from: distributerAddress });
      const product = await productContract.getProduct(productId);
      assert.equal(product.ownership.toLowerCase(), consumerAddress.toLowerCase());
    });

    it('emits ProductTransferred event', async () => {
      const tx = await productContract.transfer(distributerAddress, productId2, { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductTransferred');
      assert.ok(event, 'ProductTransferred event not emitted');
      assert.equal(event.args.id.toString(), productId2.toString());
      assert.equal(event.args.from, manufacturerAddress);
      assert.equal(event.args.to, distributerAddress);
    });

    it('get() includes transfer transactions', async () => {
      const { transactions } = await productContract.get(productId);
      assert.isAbove(transactions.length, 0);
    });
  });

  // ─── Reviews ───────────────────────────────────────────────────

  describe('Reviews', () => {
    it('only current owner can add review', async () => {
      const reverted = await shouldRevert(() =>
        productContract.addReview(productId, 80, 'Great', { from: manufacturerAddress })
      );
      assert.isTrue(reverted);
    });

    it('rejects rating above 100', async () => {
      const reverted = await shouldRevert(() =>
        productContract.addReview(productId, 101, 'Bad', { from: consumerAddress })
      );
      assert.isTrue(reverted);
    });

    it('adds a review from current owner', async () => {
      await productContract.addReview(productId, 80, 'Good product', { from: consumerAddress });
      assert.equal((await productContract.getReviewsCount()).toString(), '1');
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
      assert.ok(event, 'ProductReviewed event not emitted');
      assert.equal(event.args.id.toString(), productId.toString());
      assert.equal(event.args.reviewer, consumerAddress);
      assert.equal(event.args.rating.toString(), '60');
    });
  });

  // ─── Product History ───────────────────────────────────────────

  describe('Product History', () => {
    it('history is populated after addProduct', async () => {
      const history = await productContract.getProductHistory(productId);
      assert.isAbove(history.length, 0);
    });

    it('first history record is CREATED', async () => {
      const history = await productContract.getProductHistory(productId);
      const created = history.find(h => h.action === 'CREATED');
      assert.ok(created, 'CREATED history record not found');
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

    it('history records have non-zero timestamps', async () => {
      const history = await productContract.getProductHistory(productId);
      history.forEach(h => {
        assert.isAbove(parseInt(h.timestamp.toString()), 0);
      });
    });

    it('emits ProductHistoryAdded event on creation', async () => {
      const tx = await productContract.addProduct(11111, 'Hist Test', ['Z'], { from: manufacturerAddress });
      const event = tx.logs.find(l => l.event === 'ProductHistoryAdded');
      assert.ok(event, 'ProductHistoryAdded event not emitted');
      assert.equal(event.args.action, 'CREATED');
    });

    it('getProductHistory rejects for non-existent product', async () => {
      const reverted = await shouldRevert(() =>
        productContract.getProductHistory(99999)
      );
      assert.isTrue(reverted);
    });

    it('history count grows monotonically (append-only)', async () => {
      const before = (await productContract.getProductHistory(productId)).length;
      await productContract.addReview(productId, 50, 'Another', { from: consumerAddress });
      const after = (await productContract.getProductHistory(productId)).length;
      assert.isAbove(after, before);
    });
  });

  // ─── Revert safety ─────────────────────────────────────────────

  describe('Revert safety', () => {
    it('failed addProduct leaves count unchanged', async () => {
      const before = (await productContract.getItemIds()).length;
      await shouldRevert(() =>
        productContract.addProduct(productId, 'Dup', ['X'], { from: manufacturerAddress })
      );
      const after = (await productContract.getItemIds()).length;
      assert.equal(before, after);
    });

    it('failed transfer leaves ownership unchanged', async () => {
      const before = await productContract.getProduct(productId);
      await shouldRevert(() =>
        productContract.transfer(notOwner, productId, { from: notOwner })
      );
      const after = await productContract.getProduct(productId);
      assert.equal(before.ownership, after.ownership);
    });
  });
});