import { Link } from "react-router-dom";
import styles from "./Home.module.css";

export default function Home() {
  return (
    <div className={styles.home}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <h1>Cardano Freelance Escrow</h1>
          <p className={styles.tagline}>
            Secure, Transparent, and Instant International Payments for
            Freelancers
          </p>
          <div className={styles.actions}>
            {/* <Link to="/jobs" className={styles.button}>
              Browse Jobs
            </Link>
            <Link to="/register" className={styles.buttonSecondary}>
              Get Started
            </Link> */}
          </div>
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
      </div>
    </div>
  );
}
