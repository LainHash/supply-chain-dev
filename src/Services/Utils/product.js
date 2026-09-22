export const fetchProduct = async (curr_address, productContract, id) => {
  const callParams = curr_address ? { from: curr_address } : {};
  const response = await productContract.methods.get(id).call(callParams);
  const product = {
    "item": response.item,
    "rawProducts": response.rawProducts,
    "reviews": response.reviews,
    "transactions": response.transactions
  }
  return product;
}