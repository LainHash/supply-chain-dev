/**
 * scripts/seed-data.js
 * Populates the local Ganache blockchain with realistic sample supply chain data:
 * - Admin, Farmer, Manufacturer, Distributor, Consumer stakeholders
 * - Raw products and Admin verifications
 * - 3 finished products with lifecycle stages, transfers, and reviews
 */

const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');

const FarmerContract = require('../src/Smart-Contract/ABI/Farmer.json');
const ManufacturerContract = require('../src/Smart-Contract/ABI/Manufacturer.json');
const ProductContract = require('../src/Smart-Contract/ABI/Product.json');
const StakeholderContract = require('../src/Smart-Contract/ABI/Stakeholder.json');

const getAddress = (contractArtifact) => {
  const networks = contractArtifact.networks;
  const ids = ['1337', '5777', '1790045722949'];
  for (const id of ids) {
    if (networks[id] && networks[id].address) return networks[id].address;
  }
  const keys = Object.keys(networks);
  return keys.length > 0 ? networks[keys[keys.length - 1]].address : null;
};

async function seed() {
  console.log('🚀 Starting supply chain seed data injection on Ganache...');

  const accounts = await web3.eth.getAccounts();
  const admin = accounts[0];
  const farmer = accounts[1];
  const manufacturer = accounts[2];
  const distributor = accounts[3];
  const consumer = accounts[4];

  console.log('Admin:', admin);
  console.log('Farmer:', farmer);
  console.log('Manufacturer:', manufacturer);
  console.log('Distributor:', distributor);
  console.log('Consumer:', consumer);

  const farmerAddr = getAddress(FarmerContract);
  const manuAddr = getAddress(ManufacturerContract);
  const productAddr = getAddress(ProductContract);
  const stakeAddr = getAddress(StakeholderContract);

  const farmerC = new web3.eth.Contract(FarmerContract.abi, farmerAddr);
  const manuC = new web3.eth.Contract(ManufacturerContract.abi, manuAddr);
  const productC = new web3.eth.Contract(ProductContract.abi, productAddr);
  const stakeC = new web3.eth.Contract(StakeholderContract.abi, stakeAddr);

  // 1. Farmer Registration & Raw Products
  console.log('\n🌾 1. Registering Farmer & Raw Products...');
  try {
    const existing = await farmerC.methods.getFarmer(farmer).call({ from: admin });
    if (!existing.farmer || !existing.farmer.name) {
      await farmerC.methods.addFarmer(
        'Nông Trại Hữu Cơ Đà Lạt',
        'Cầu Đất, TP. Đà Lạt, Lâm Đồng',
        ['Hạt Cà Phê Arabica Cầu Đất', 'Lá Trà Oolong Bảo Lộc', 'Dâu Tây Đà Lạt']
      ).send({ from: farmer, gas: 3000000 });
      console.log('✅ Farmer registered: Nông Trại Hữu Cơ Đà Lạt');
    } else {
      console.log('ℹ️ Farmer already registered');
    }

    await farmerC.methods.verifyFarmer(farmer).send({ from: admin, gas: 500000 });
    console.log('✅ Farmer verified by Admin');
  } catch (err) {
    console.log('Farmer setup notice:', err.message);
  }

  // 2. Manufacturer Registration
  console.log('\n🏭 2. Registering Manufacturer...');
  try {
    const existing = await manuC.methods.get(manufacturer).call({ from: admin });
    if (!existing.name) {
      await manuC.methods.register(
        'Nhà Máy Chế Biến Nông Sản Tây Nguyên',
        'TP. Buôn Ma Thuột, Đắk Lắk',
        'manufacturer'
      ).send({ from: manufacturer, gas: 1000000 });

      await manuC.methods.addManufacturer(
        'Nhà Máy Chế Biến Nông Sản Tây Nguyên',
        ['Hạt Cà Phê Arabica Cầu Đất', 'Lá Trà Oolong Bảo Lộc'],
        [farmer, farmer]
      ).send({ from: manufacturer, gas: 3000000 });
      console.log('✅ Manufacturer registered: Nhà Máy Chế Biến Nông Sản Tây Nguyên');
    } else {
      console.log('ℹ️ Manufacturer already registered');
    }

    await manuC.methods.verifyManufacturer(manufacturer).send({ from: admin, gas: 500000 });
    console.log('✅ Manufacturer verified (Renewable Energy certified)');
  } catch (err) {
    console.log('Manufacturer setup notice:', err.message);
  }

  // 3. Distributor Registration
  console.log('\n🚚 3. Registering Distributor...');
  try {
    const existing = await stakeC.methods.get(distributor).call({ from: admin });
    if (!existing.name) {
      await stakeC.methods.register(
        'Tổng Kho Vận Tải Chuỗi Lạnh Toàn Quốc',
        'Khu Công Nghiệp Tân Bình, TP. Hồ Chí Minh',
        'distributor'
      ).send({ from: distributor, gas: 1000000 });
      console.log('✅ Distributor registered');
    }
    await stakeC.methods.verify(distributor).send({ from: admin, gas: 500000 });
    console.log('✅ Distributor verified by Admin');
  } catch (err) {
    console.log('Distributor setup notice:', err.message);
  }

  // 4. Consumer Registration
  console.log('\n🛒 4. Registering Consumer...');
  try {
    const existing = await stakeC.methods.get(consumer).call({ from: admin });
    if (!existing.name) {
      await stakeC.methods.register(
        'Nguyễn Văn A (Người Tiêu Dùng)',
        'Quận Cầu Giấy, Hà Nội',
        'consumer'
      ).send({ from: consumer, gas: 1000000 });
      console.log('✅ Consumer registered');
    }
  } catch (err) {
    console.log('Consumer setup notice:', err.message);
  }

  // 5. Products Seed
  console.log('\n📦 5. Creating Products & Lifecycle Events...');

  // Product 101: Coffee (Fully Completed with Transfer & Reviews)
  try {
    let p1 = await productC.methods.getProduct(101).call();
    if (!p1.isValue) {
      await productC.methods.add(
        101,
        'Cà Phê Arabica Cầu Đất Thượng Hạng',
        [['Hạt Cà Phê Arabica Cầu Đất', true]],
        'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80'
      ).send({ from: manufacturer, gas: 2000000 });
      await manuC.methods.launchProduct(101).send({ from: manufacturer, gas: 500000 });
      console.log('✅ Product 101 created: Cà Phê Arabica Cầu Đất');
      p1 = await productC.methods.getProduct(101).call();
    } else {
      console.log('ℹ️ Product 101 already exists');
    }

    if (p1.ownership.toLowerCase() === manufacturer.toLowerCase()) {
      await productC.methods.transfer(distributor, 101).send({ from: manufacturer, gas: 500000 });
      console.log('🚚 Product 101 transferred to Distributor');
      p1 = await productC.methods.getProduct(101).call();
    }

    if (p1.ownership.toLowerCase() === distributor.toLowerCase()) {
      await productC.methods.transfer(consumer, 101).send({ from: distributor, gas: 500000 });
      console.log('🛒 Product 101 transferred to Consumer');
      await productC.methods.addReview(
        101,
        96,
        'Hương thơm nguyên bản ngào ngạt, vị đắng thanh dịu, nguồn gốc rõ ràng từ nông trại!'
      ).send({ from: consumer, gas: 500000 });
      console.log('⭐ Product 101 received review (Rating: 96/100)');
    }
  } catch (err) {
    console.log('Product 101 notice:', err.message);
  }

  // Product 102: Tea (At Distributor stage)
  try {
    let p2 = await productC.methods.getProduct(102).call();
    if (!p2.isValue) {
      await productC.methods.add(
        102,
        'Trà Oolong Thượng Hạng Bảo Lộc',
        [['Lá Trà Oolong Bảo Lộc', true]],
        'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80'
      ).send({ from: manufacturer, gas: 2000000 });
      await manuC.methods.launchProduct(102).send({ from: manufacturer, gas: 500000 });
      console.log('✅ Product 102 created: Trà Oolong Thượng Hạng');
      p2 = await productC.methods.getProduct(102).call();
    } else {
      console.log('ℹ️ Product 102 already exists');
    }

    if (p2.ownership.toLowerCase() === manufacturer.toLowerCase()) {
      await productC.methods.transfer(distributor, 102).send({ from: manufacturer, gas: 500000 });
      console.log('🚚 Product 102 transferred to Distributor');
      await productC.methods.addReview(
        102,
        92,
        'Hàng đóng gói đạt chuẩn vệ sinh an toàn thực phẩm, bao bì bảo quản tốt.'
      ).send({ from: distributor, gas: 500000 });
      console.log('⭐ Product 102 received review from Distributor');
    }
  } catch (err) {
    console.log('Product 102 notice:', err.message);
  }

  // Product 103: Dried Strawberry (At Manufacturer stage)
  try {
    const p3 = await productC.methods.getProduct(103).call();
    if (!p3.isValue) {
      await productC.methods.add(
        103,
        'Dâu Tây Sấy Thăng Hoa Đà Lạt',
        [['Dâu Tây Đà Lạt', true]],
        'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&auto=format&fit=crop&q=80'
      ).send({ from: manufacturer, gas: 2000000 });
      await manuC.methods.launchProduct(103).send({ from: manufacturer, gas: 500000 });
      console.log('✅ Product 103 created: Dâu Tây Sấy Thăng Hoa');
    } else {
      console.log('ℹ️ Product 103 already exists');
    }
  } catch (err) {
    console.log('Product 103 notice:', err.message);
  }

  const count = await productC.methods.getProductsCount().call();
  const txCount = await productC.methods.getTransactionsCount().call();
  const revCount = await productC.methods.getReviewsCount().call();

  console.log('\n========================================');
  console.log(`🎉 SEED HOÀN TẤT THÀNH CÔNG!`);
  console.log(`- Tổng sản phẩm (Products): ${count}`);
  console.log(`- Tổng giao dịch luân chuyển (Transactions): ${txCount}`);
  console.log(`- Tổng đánh giá (Reviews): ${revCount}`);
  console.log('========================================\n');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
