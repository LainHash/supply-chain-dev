import { createContext, useContext, useEffect, useReducer, useState } from "react";
import { contractReducer } from "../Reducers/ContractReducer";

import MainContract from '../../Smart-Contract/ABI/Main.json';
import StakeholderContract from '../../Smart-Contract/ABI/Stakeholder.json';
import FarmerContract from '../../Smart-Contract/ABI/Farmer.json';
import ManufacturerContract from '../../Smart-Contract/ABI/Manufacturer.json';
import ProductContract from '../../Smart-Contract/ABI/Product.json';
import { 
  contractStateMain, 
  contractStateProduct,
  contractStateFarmer, 
  contractStateManufacturer,
  contractStateStakeholder, 
  contractStateStats 
} from '../Actions/ContractActionCreator';
import { authStateStakeholder } from '../Actions/AuthActionCreator';
import { AuthContext } from "./AuthContext";

export const ContractContext = createContext();
export const ContractContextProvider = ({children}) => {
  const [contractState, contractDispatch] = useReducer(contractReducer, {
    isLoading: false,
    errMess: null,
    mainContract: null,
    farmerContract: null,
    manufacturerContract: null,
    stakeholderContract: null,
    productContract: null,
    stats: {
      productsCount: 0,
      transactionsCount: 0,
      reviewsCount: 0
    }
  })
  const [networkId, setNetworkId] = useState(null);
  const { authState, authDispatch } = useContext(AuthContext);

  const getContractAddress = (contract, netId) => {
    if (!contract || !contract.networks) return null;
    if (netId && contract.networks[netId] && contract.networks[netId].address) {
      return contract.networks[netId].address;
    }
    // Fallback to local networks: 1337, 5777, 1790045722949, or latest deployed
    const fallbackIds = ["1337", "5777", "1790045722949"];
    for (let id of fallbackIds) {
      if (contract.networks[id] && contract.networks[id].address) {
        return contract.networks[id].address;
      }
    }
    const keys = Object.keys(contract.networks);
    if (keys.length > 0) {
      return contract.networks[keys[keys.length - 1]].address;
    }
    return null;
  };

  const ensureGanacheNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x539" }], // 1337
      });
    } catch (switchError) {
      if (switchError.code === 4902 || switchError.message?.includes("Unrecognized")) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x539",
              chainName: "Ganache Local",
              rpcUrls: ["http://127.0.0.1:7545"],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
            }],
          });
        } catch (addError) {
          console.warn("Could not add Ganache network automatically:", addError);
        }
      }
    }
  };

  useEffect(() => {
    (async () => {
      if(authState.isWeb3Enabled){
        try {
          const web3 = window.web3;
          const networkId = await web3.eth.net.getId();
          setNetworkId(networkId);

          const mainAddr = getContractAddress(MainContract, networkId);
          const productAddr = getContractAddress(ProductContract, networkId);
          const farmerAddr = getContractAddress(FarmerContract, networkId);
          const manufacturerAddr = getContractAddress(ManufacturerContract, networkId);

          if (!mainAddr || !productAddr) {
            console.warn("Smart contracts are not deployed on the current network (" + networkId + "). Please switch MetaMask to Ganache Local (http://127.0.0.1:7545).");
            await ensureGanacheNetwork();
            return;
          }

          // Verify that contract bytecode actually exists at mainAddr on the active network
          const code = await web3.eth.getCode(mainAddr);
          if (!code || code === "0x" || code === "0x0") {
            console.warn("No contract bytecode at " + mainAddr + " on network " + networkId + ". Prompting switch to Ganache Local...");
            await ensureGanacheNetwork();
            return;
          }

          const main = new web3.eth.Contract(MainContract.abi, mainAddr);
          contractDispatch(contractStateMain(main));
          const product  = new web3.eth.Contract(ProductContract.abi, productAddr);
          contractDispatch(contractStateProduct(product));
          const farmer = new web3.eth.Contract(FarmerContract.abi, farmerAddr);
          contractDispatch(contractStateFarmer(farmer));
          const manufacturer = new web3.eth.Contract(ManufacturerContract.abi, manufacturerAddr);
          contractDispatch(contractStateManufacturer(manufacturer));

          const stats = {};
          stats["productsCount"] = await product.methods.getProductsCount().call();
          stats["transactionsCount"] = await product.methods.getTransactionsCount().call();
          stats["reviewsCount"] = await product.methods.getReviewsCount().call();
          contractDispatch(contractStateStats(stats));
        } catch (err) {
          console.error("Failed to load contracts:", err);
        }
      }
    })();
  }, [authState.isWeb3Enabled])

  useEffect(() => {
    (async () => {
      if(authState.isAuthenticated && contractState.mainContract && authState.address){
        try {
          const web3 = window.web3;
          const role = await contractState.mainContract.methods.getRole(authState.address).call();
          if( role === "farmer"){
            const addr = getContractAddress(FarmerContract, networkId);
            if (addr) {
              const farmer = new web3.eth.Contract(FarmerContract.abi, addr);
              contractDispatch(contractStateStakeholder(farmer));
            }
          }
          else if(role === 'manufacturer'){
            const addr = getContractAddress(ManufacturerContract, networkId);
            if (addr) {
              const manufacturer = new web3.eth.Contract(ManufacturerContract.abi, addr);
              contractDispatch(contractStateStakeholder(manufacturer));
            }
          }
          else {
            const addr = getContractAddress(StakeholderContract, networkId);
            if (addr) {
              const stakeholder = new web3.eth.Contract(StakeholderContract.abi, addr);
              contractDispatch(contractStateStakeholder(stakeholder));
            }
          }
        } catch (err) {
          console.error("Failed to resolve user role:", err);
        }
      }
    })();
  }, [authState.isAuthenticated, contractState.mainContract, authState.address])

  useEffect(() => {
    (async () => {
      await loadStakeholder();
    })();
  }, [contractState.stakeholderContract])

  const loadStakeholder = async () => {
    if(contractState.stakeholderContract && authState.address && contractState.mainContract){
      try {
        let stakeholderDetails = await contractState.stakeholderContract.methods.get(authState.address).call({from: authState.address});
        stakeholderDetails = {
          id: stakeholderDetails.id,
          name: stakeholderDetails.name,
          location: stakeholderDetails.location,
          role: stakeholderDetails.role === "" ? "new" : stakeholderDetails.role,
          isRegistered: stakeholderDetails.role === "" ? false : true,
          isVerified: stakeholderDetails.isVerified
        }
        const role = await contractState.mainContract.methods.getRole(authState.address).call();
        if(role == "admin"){
          stakeholderDetails.role = role;
        }
        authDispatch(authStateStakeholder(stakeholderDetails));
      } catch (err) {
        console.error("Failed to load stakeholder details:", err);
      }
    }
  }

  const updateStats = async () => {
    const stats = {};
    stats["productsCount"] = await contractState.productContract.methods.getProductsCount().call();
    stats["transactionsCount"] = await contractState.productContract.methods.getTransactionsCount().call();
    stats["reviewsCount"] = await contractState.productContract.methods.getReviewsCount().call();
    contractDispatch(contractStateStats(stats));
  }

  return (
    <ContractContext.Provider value={{contractState, contractDispatch, updateStats, loadStakeholder}}>
      {children}
    </ContractContext.Provider>
  )

}
