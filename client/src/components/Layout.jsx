import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useWallet } from "@meshsdk/react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import Footer from "./Footer.jsx";
import styles from "./Layout.module.css";

export default function Layout({ children }) {
  const { connected, connect, disconnect, name } = useWallet();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { success, error: showError } = useToast();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const walletNames = [
    { id: "nami", name: "Nami Wallet" },
    { id: "eternl", name: "Eternl Wallet" },
    { id: "lace", name: "Lace Wallet" },
    { id: "flint", name: "Flint Wallet" },
    { id: "gero", name: "Gero Wallet" },
    { id: "typhon", name: "Typhon Wallet" },
  ];

  const getInstalledWallets = () => {
    return walletNames.filter((wallet) => window.cardano?.[wallet.id]);
  };

  const handleConnectClick = () => {
    if (!isAuthenticated) {
      showError("Please login first to connect your wallet");
      navigate("/login");
      return;
    }

    const installedWallets = getInstalledWallets();
    if (installedWallets.length === 0) {
      alert(
        "Please install a Cardano wallet extension:\n\n" +
          "• Nami Wallet\n" +
          "• Eternl Wallet\n" +
          "• Lace Wallet\n" +
          "• Flint Wallet\n" +
          "• Gero Wallet\n" +
          "• Typhon Wallet\n\n" +
          "After installing, refresh the page and try again."
      );
      return;
    }

    setShowWalletModal(true);
  };

  const handleWalletSelect = async (walletId) => {
    try {
      setShowWalletModal(false);
      await connect(walletId);
      success(
        `Successfully connected to ${
          walletNames.find((w) => w.id === walletId)?.name || walletId
        }`
      );
    } catch (error) {
      console.error("Wallet connection error:", error);
      showError(
        `Failed to connect to wallet: ${error.message || "Unknown error"}\n\n` +
          "Please ensure your wallet extension is unlocked."
      );
    }
  };

  const handleDisconnect = () => {
    if (!isAuthenticated) {
      showError("Please login first");
      navigate("/login");
      return;
    }
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
          <Link to="/" className={styles.logo}>
            <h1>BlockPay</h1>
          </Link>
          <nav className={styles.nav}>
            {/* Desktop Nav */}
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
                  <button onClick={handleLogout} className={styles.navButton}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">Login</Link>
                  <Link to="/register">Sign Up</Link>
                </>
              )}
            </div>

            <div className={styles.actions}>
              <button onClick={toggleTheme} className={styles.themeToggle} aria-label="Toggle theme">
                  {theme === 'dark' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  )}
              </button>

              <div className={styles.desktopWallet}>
                {connected ? (
                  <>
                    <button
                      onClick={handleDisconnect}
                      className={styles.buttonSmall}
                    >
                      Disconnect
                    </button>
                    <span className={styles.walletName}>{name}</span>
                  </>
                ) : (
                  <button
                    onClick={handleConnectClick}
                    className={styles.buttonSmall}
                  >
                    Connect Wallet
                  </button>
                )}
              </div>

              {/* Mobile Menu Toggle */}
              <button 
                className={styles.menuToggle} 
                onClick={toggleMenu}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                )}
              </button>
            </div>
          </nav>
        </div>

        {/* Mobile Menu Overlay */}
        <div className={`${styles.mobileMenu} ${isMenuOpen ? styles.open : ''}`}>
          <div className={styles.mobileNavLinks}>
            <Link to="/jobs" onClick={() => setIsMenuOpen(false)}>Jobs</Link>
            {isAuthenticated ? (
              <>
                {user?.role === "client" && (
                  <Link to="/jobs/post" onClick={() => setIsMenuOpen(false)}>Post Job</Link>
                )}
                <Link
                  to={user?.role === "client" ? "/dashboard/client" : "/dashboard/freelancer"}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <div className={styles.mobileUser}>
                  <span>{user?.displayName || user?.email}</span>
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className={styles.buttonSecondary}>
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMenuOpen(false)}>Login</Link>
                <Link to="/register" onClick={() => setIsMenuOpen(false)}>Sign Up</Link>
              </>
            )}
            
            <div className={styles.mobileWallet}>
               {connected ? (
                  <button onClick={handleDisconnect} className={styles.buttonSmall}>
                    Disconnect ({name})
                  </button>
                ) : (
                  <button onClick={() => { handleConnectClick(); setIsMenuOpen(false); }} className={styles.buttonSmall}>
                    Connect Wallet
                  </button>
                )}
            </div>
          </div>
        </div>
      </header>
      {showWalletModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowWalletModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Select Wallet</h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowWalletModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.walletList}>
              {getInstalledWallets().map((wallet) => (
                <button
                  key={wallet.id}
                  className={styles.walletOption}
                  onClick={() => handleWalletSelect(wallet.id)}
                >
                  {wallet.name}
                </button>
              ))}
            </div>
            {getInstalledWallets().length === 0 && (
              <p className={styles.noWallets}>
                No wallets detected. Please install a Cardano wallet extension.
              </p>
            )}
          </div>
        </div>
      )}
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}
