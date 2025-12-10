import { CardanoWallet, useWallet } from "@meshsdk/react";

export function WalletConnect() {
  const { connected } = useWallet();

  return (
    <div className="wallet-connect">
      <CardanoWallet
        label={connected ? "Wallet connected" : "Connect wallet"}
      />
    </div>
  );
}
