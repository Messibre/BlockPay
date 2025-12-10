import { Link } from "react-router-dom";
import { useWallet } from "@meshsdk/react";
import { useAuth } from "../contexts/AuthContext.jsx";
import styles from "./Home.module.css";

export default function Home() {
  const { connected, address } = useWallet();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className={styles.home}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <h1>Cardano Freelance Escrow</h1>
          <p className={styles.tagline}>
            Secure, Transparent, and Instant International Payments for
            Freelancers
          </p>

          {isAuthenticated ? (
            <div className={styles.welcomeSection}>
              <h2>Welcome back, {user?.displayName || user?.email}!</h2>
              <p className={styles.userInfo}>
                Role: <strong>{user?.role || "N/A"}</strong>
                {user?.walletAddress && (
                  <>
                    <br />
                    Wallet: <code>{user.walletAddress.slice(0, 20)}...</code>
                  </>
                )}
              </p>
              {connected && address && (
                <p className={styles.walletStatus}>
                  ✓ Wallet Connected: <code>{address.slice(0, 20)}...</code>
                </p>
              )}
              <div className={styles.actions}>
                <Link to="/jobs" className={styles.button}>
                  Browse Jobs
                </Link>
                {user?.role === "client" && (
                  <Link to="/jobs/post" className={styles.buttonSecondary}>
                    Post a Job
                  </Link>
                )}
                {user?.role === "freelancer" && (
                  <Link to="/jobs" className={styles.buttonSecondary}>
                    Find Work
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <Link to="/jobs" className={styles.button}>
                Browse Jobs
              </Link>
              <Link to="/register" className={styles.buttonSecondary}>
                Get Started
              </Link>
              <Link to="/login" className={styles.buttonTertiary}>
                Login
              </Link>
            </div>
          )}
        </section>

        <section className={styles.features}>
          <h2>How It Works</h2>
          <div className={styles.featureGrid}>
            <div className={styles.feature}>
              <h3>1. Create Job</h3>
              <p>Clients post jobs with milestones and budgets</p>
            </div>
            <div className={styles.feature}>
              <h3>2. Fund Escrow</h3>
              <p>Funds are locked in a Cardano smart contract</p>
            </div>
            <div className={styles.feature}>
              <h3>3. Deliver Work</h3>
              <p>Freelancers submit deliverables for approval</p>
            </div>
            <div className={styles.feature}>
              <h3>4. Get Paid</h3>
              <p>Funds released automatically when approved</p>
            </div>
          </div>
        </section>

        {!connected && isAuthenticated && (
          <section className={styles.walletPrompt}>
            <h2>Connect Your Wallet</h2>
            <p>
              Connect your Cardano wallet to start creating jobs or applying for
              work.
            </p>
            <p className={styles.walletHint}>
              Click "Connect Wallet" in the header to get started.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
