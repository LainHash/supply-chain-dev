import { useReducer, createContext, useEffect } from "react";
import { authReducuer } from "../Reducers/AuthReducer";
import { authStateEnableWeb3, authStateLogin, authStateFailed, authStateDisableWeb3, authStateLogout } from '../Actions/AuthActionCreator';
import Web3 from "web3";
import Toast from "../../Components/Toast";

export const AuthContext = createContext();
export const AuthContextProvider = ({children}) => {
  const [authState, authDispatch] = useReducer(authReducuer, {
    isLoading: false,
    errMess: null,
    isWeb3Enabled: false,
    isAuthenticated: false,
    address: null,
    formattedAddress: null,
    stakeholder: {}
  })

  useEffect(() => {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      try {
        if (window.ethereum.request) {
          window.ethereum.request({ method: "eth_accounts" }).then(accounts => {
            if (accounts && accounts.length > 0) {
              authDispatch(authStateLogin(accounts[0]));
            }
          }).catch(console.warn);
        } else if (window.ethereum.enable) {
          window.ethereum.enable().catch(console.warn);
        }
      } catch (e) {
        console.warn("Could not auto-request accounts:", e);
      }
      authDispatch(authStateEnableWeb3());

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts && accounts.length > 0) {
          authDispatch(authStateLogin(accounts[0]));
          window.location.reload();
        } else {
          authDispatch(authStateLogout());
        }
      });
    }
    else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
      authDispatch(authStateEnableWeb3());
    }
    else {
      // Fallback to Read-Only HTTP Provider so users scanning QR codes on mobile / guest browsers can view origin traceability
      try {
        const fallbackRpc = process.env.REACT_APP_RPC_URL || "http://127.0.0.1:7545";
        window.web3 = new Web3(new Web3.providers.HttpProvider(fallbackRpc));
        authDispatch(authStateEnableWeb3());
      } catch (err) {
        console.warn("Fallback Web3 provider unavailable:", err);
        const errMess = "Non-Ethereum browser detected";
        authDispatch(authStateFailed(errMess));
        authDispatch(authStateDisableWeb3());
      }
    }
  }, [])


  const connectWallet = async () => {
    if (!window.ethereum) {
      Toast("error", "Vui lòng cài đặt ví MetaMask trên trình duyệt để đăng nhập.");
      return;
    }
    try {
      const selectedAccount = await window.ethereum
        .request({
          method: "eth_requestAccounts",
        })
        .then((accounts) => accounts && accounts.length > 0 ? accounts[0] : null)
        .catch(() => {
          Toast("error", "Please select an account");
        });
      if (selectedAccount) {
        authDispatch(authStateLogin(selectedAccount));
        Toast("success", "Successfully Logged in");
      }
    } catch( error ) {
      Toast("error", error.message);
    }
  }

  const logout = () => {
    try{
      authDispatch(authStateLogout());
      Toast("success", "Successfully Logged out");
    } catch( error ){
      Toast("error", error.message);
    }
  }

  return (
    <AuthContext.Provider value={{authState, authDispatch, connectWallet, logout}}>
      {children}
    </AuthContext.Provider>
  )
}