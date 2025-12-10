import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@meshsdk/react";
import styles from "./Layout.module.css";

export default function Layout({ children }) {
  const { connected, connect, disconnect, name } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      // Try connecting to available wallets (Nami, Eternl, Lace)
      const wallets = ["nami", "eternl", "lace"];
      let connected = false;

      for (const walletName of wallets) {
        try {
          await connect(walletName);
          connected = true;
          break;
        } catch (err) {
          // Try next wallet
          continue;
        }
      }

      if (!connected) {
        alert(
          "Please install a Cardano wallet extension:\n- Nami\n- Eternl\n- Lace"
        );
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert(
        "Wallet connection failed. Please ensure you have a Cardano wallet installed."
      );
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/");
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.container}>
          {/* <Link to="/" className={styles.logo}>
            <h1>Cardano Escrow</h1>
          </Link> */}
          <nav className={styles.nav}>
            {/* <Link to="/jobs">Jobs</Link> */}
            {connected ? (
              <>
                <span className={styles.walletName}>{name}</span>
                <button onClick={handleDisconnect} className={styles.button}>
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={handleConnect} className={styles.button}>
                Connect Wallet
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>Cardano Freelance Escrow - Secure payments on blockchain</p>
        </div>
      </footer>
    </div>
  );
}
