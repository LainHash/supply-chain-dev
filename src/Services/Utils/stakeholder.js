export const fetchFarmer = async (curr_address, farmerContract, id) => {
  const callParams = curr_address ? { from: curr_address } : {};
  const response = await farmerContract.methods.getFarmer(id).call(callParams);
  return {
    ...response.farmer,
    formattedAddress: formattedAddress(id),
    rawProducts: response.rawProducts
  }
}

export const fetchManufacturer = async (curr_address, manufacturerContract, id) => {
  const callParams = curr_address ? { from: curr_address } : {};
  const response = await manufacturerContract.methods.getManufacturer(id).call(callParams);
  return {
    ...response.manufacturer,
    isRenewableUsed: response.isRenewableUsed,
    formattedAddress: formattedAddress(id),
    rawProducts: response.rawProducts,
    launchedProductIds: response.launchedProductIds
  }
}

export const fetchStakeholder = async (curr_address, stakeholderContract, id) => {
  const callParams = curr_address ? { from: curr_address } : {};
  const response = await stakeholderContract.methods.get(id).call(callParams);
  return {
    ...response,
    formattedAddress: formattedAddress(id),
  }
}

export const formattedAddress = (address) => {
  if (!address || typeof address !== 'string') return "N/A";
  if (address.length <= 10) return address;
  return address.substring(0, 6) + "..." + address.substring(address.length - 4);
}