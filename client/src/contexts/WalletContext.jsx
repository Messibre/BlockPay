import React, { createContext, useContext, useState, useEffect } from "react";
import { useWallet, useAddress } from "@meshsdk/react";

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const { connected, wallet, connect, disconnect, connecting } = useWallet();
  const address = useAddress();
  const [walletName, setWalletName] = useState(null);

  useEffect(() => {
    if (connected && wallet) {
      // Mesh handles persistence mostly
    }
  }, [connected, wallet]);

  const connectWallet = async (name) => {
    try {
      await connect(name);
      setWalletName(name);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  };

  const value = {
    connected,
    connecting,
    address,
    wallet,
    connect: connectWallet,
    disconnect,
    walletName,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

export const useCardanoWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useCardanoWallet must be used within a WalletProvider");
  }
  return context;
};
