import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@meshsdk/react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import styles from "./Layout.module.css";

export default function Layout({ children }) {
  const { connected, connect, disconnect, name } = useWallet();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { success } = useToast();

  const handleConnect = async () => {
    try {
      // Check for installed Cardano wallets
      const walletNames = ["nami", "eternl", "lace", "flint", "gero", "typhon"];
      const installedWallets = walletNames.filter(
        (name) => window.cardano?.[name]
      );

      if (installedWallets.length === 0) {
        alert(
          "Please install a Cardano wallet extension:\n\n" +
            "• Nami Wallet\n" +
            "• Eternl Wallet\n" +
            "• Lace Wallet\n" +
            "• Flint Wallet\n" +
            "• Gero Wallet\n\n" +
            "After installing, refresh the page and try again."
        );
        return;
      }

      // Try connecting to each wallet until one works
      let connectedWallet = null;
      for (const walletName of installedWallets) {
        try {
          console.log(`Attempting to connect to ${walletName}...`);
          await connect(walletName);
          connectedWallet = walletName;
          console.log(`Successfully connected to ${walletName}`);
          break;
        } catch (err) {
          console.log(`${walletName} connection failed:`, err.message);
          // Continue to next wallet
          continue;
        }
      }

      if (!connectedWallet) {
        alert(
          "Failed to connect to any wallet. Please:\n\n" +
            "1. Make sure your wallet extension is unlocked\n" +
            "2. Try refreshing the page\n" +
            "3. Check if the wallet is enabled in your browser"
        );
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      alert(
        `Wallet connection failed: ${error.message || "Unknown error"}\n\n` +
          "Please ensure your wallet extension is installed and unlocked."
      );
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/");
  };

  const handleLogout = () => {
    logout();
    success("Logged out successfully");
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
            <Link to="/" className={styles.logo}>
              <h1>Cardano Escrow</h1>
            </Link>
            <div className={styles.navLinks}>
              <Link to="/jobs">Jobs</Link>
              {isAuthenticated ? (
                <>
                  {user?.role === "client" && (
                    <Link to="/jobs/post">Post Job</Link>
                  )}
                  <Link
                    to={
                      user?.role === "client"
                        ? "/dashboard/client"
                        : "/dashboard/freelancer"
                    }
                  >
                    Dashboard
                  </Link>
                  <span className={styles.userName}>
                    {user?.displayName || user?.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className={styles.buttonSecondary}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className={styles.buttonSecondary}>
                    Login
                  </Link>
                  <Link to="/register" className={styles.button}>
                    Sign Up
                  </Link>
                </>
              )}
            </div>
            <div className={styles.walletSection}>
              {connected ? (
                <>
                  <span className={styles.walletName}>{name}</span>
                  <button
                    onClick={handleDisconnect}
                    className={styles.buttonSmall}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={handleConnect} className={styles.buttonSmall}>
                  Connect Wallet
                </button>
              )}
            </div>
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
