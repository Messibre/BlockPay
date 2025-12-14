import { Link } from "react-router-dom";
import { useWallet } from "@meshsdk/react";
import { useAuth } from "../contexts/AuthContext.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import styles from "./Home.module.css";

export default function Home() {
  const { connected, address } = useWallet();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className={styles.home}>
      <div className={styles.container}>
        {/* HERO SECTION */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className="title-display">
              The <span className="text-gradient">Future</span> of <br />
              Freelance Escrow
            </h1>
            <p className={styles.tagline}>
              Secure, transparent, and instant payments built on Cardano. 
              Smart contracts ensure you get paid on time, every time.
            </p>

            <div className={styles.actions}>
              {!isAuthenticated ? (
                <>
                  <Link to="/jobs">
                    <Button size="large">Browse Jobs</Button>
                  </Link>
                  <Link to="/register">
                    <Button size="large" variant="secondary">Get Started</Button>
                  </Link>
                </>
              ) : (
                <>
                  {user?.role === "client" ? (
                    <Link to="/jobs/post">
                      <Button size="large">Post a Job</Button>
                    </Link>
                  ) : (
                    <Link to="/jobs">
                      <Button size="large">Find Work</Button>
                    </Link>
                  )}
                  <Link to={user?.role === "client" ? "/dashboard/client" : "/dashboard/freelancer"}>
                    <Button size="large" variant="ghost">Go to Dashboard →</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
          
          {/* Stats / Trust Logic could go here */}
        </section>

        {/* WALLET STATUS (Condensed) */}
        {isAuthenticated && (
          <div className={styles.statusSection}>
             <Card className={styles.statusCard}>
               <div className={styles.statusContent}>
                 <div>
                   <span className={styles.label}>Logged in as</span>
                   <strong className={styles.value}>{user?.displayName || user?.email}</strong>
                   <span className={styles.roleBadge}>{user?.role}</span>
                 </div>
                 
                 <div className={styles.walletInfo}>
                   <span className={styles.label}>Wallet Connection</span>
                   {connected && address ? (
                     <span className={styles.connected}>
                       <span className={styles.dot}></span> {address.slice(0, 12)}...{address.slice(-6)}
                     </span>
                   ) : (
                     <span className={styles.disconnected}>
                       <span className={styles.dotRed}></span> Not Connected
                     </span>
                   )}
                 </div>
               </div>
             </Card>
          </div>
        )}

        {/* FEATURES GRID */}
        <section className={styles.features}>
          <div className={styles.sectionHeader}>
            <h2>How It Works</h2>
            <p>Simple, secure, and decentralized workflow.</p>
          </div>
          
          <div className={styles.featureGrid}>
            <Card className={styles.featureCard}>
              <div className={styles.iconWrapper}>1</div>
              <h3>Create & Agree</h3>
              <p>Client posts a job and selects a freelancer. Both parties agree on milestones and budget.</p>
            </Card>

            <Card className={styles.featureCard}>
              <div className={styles.iconWrapper}>2</div>
              <h3>Lock Funds</h3>
              <p>Client deposits ADA into a secure smart contract. Funds are locked safely on-chain.</p>
            </Card>

            <Card className={styles.featureCard}>
              <div className={styles.iconWrapper}>3</div>
              <h3>Deliver Work</h3>
              <p>Freelancer submits work for review. Multiple milestones keep progress on track.</p>
            </Card>

            <Card className={styles.featureCard}>
              <div className={styles.iconWrapper}>4</div>
              <h3>Instant Pay</h3>
              <p>Once approved, the smart contract automatically releases funds to the freelancer.</p>
            </Card>
          </div>
        </section>

        {/* CTA SECTION */}
        {!isAuthenticated && (
          <section className={styles.cta}>
            <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
              <h2>Ready to start?</h2>
              <p>Join thousands of freelancers and clients building on Cardano.</p>
              <br />
              <Link to="/register">
                <Button size="large">Create Account</Button>
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
