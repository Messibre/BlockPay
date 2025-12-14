import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import styles from "./WalletPicker.module.css";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useWallet } from "@meshsdk/react";

export default function WalletPicker({ isOpen, onClose, onSelect }) {
  const { user } = useAuth();
  const { address } = useWallet();

  const wallets = (user?.wallets || []).map((w) => w.address);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose wallet to use"
      size="small"
    >
      <div className={styles.list}>
        {wallets.length === 0 && <p>No saved wallets on your account.</p>}

        {wallets.map((a) => (
          <div key={a} className={styles.item}>
            <div className={styles.addr}>{a}</div>
            <Button onClick={() => onSelect(a)}>Use this wallet</Button>
          </div>
        ))}

        <hr />

        <div className={styles.item}>
          <div className={styles.addr}>Currently connected</div>
          <div className={styles.addrSmall}>{address || "Not connected"}</div>
          <Button onClick={() => onSelect(address)}>
            Use connected wallet
          </Button>
        </div>
      </div>
    </Modal>
  );
}
