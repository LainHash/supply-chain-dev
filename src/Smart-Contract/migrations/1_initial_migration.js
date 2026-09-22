const Admin        = artifacts.require('Admin');
const Stakeholder  = artifacts.require('Stakeholder');
const Farmer       = artifacts.require('Farmer');
const Manufacturer = artifacts.require('Manufacturer');
const Product      = artifacts.require('Product');
const Main         = artifacts.require('Main');

module.exports = async function (deployer) {
  // Deploy independent contracts first
  await deployer.deploy(Farmer);
  const farmer = await Farmer.deployed();

  await deployer.deploy(Manufacturer);
  const manufacturer = await Manufacturer.deployed();

  await deployer.deploy(Stakeholder);
  const stakeholder = await Stakeholder.deployed();

  await deployer.deploy(Product);
  // Product deployed – ABI artifact updated automatically

  // Main aggregator (role resolver)
  await deployer.deploy(Main, farmer.address, manufacturer.address, stakeholder.address);
};
