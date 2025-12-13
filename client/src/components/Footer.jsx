import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.container}`}>
        <div className={styles.content}>
          <div className={styles.branding}>
            <h3>BlockPay</h3>
            <p>
              Secure, decentralized escrow platform for freelancers and clients.
              Built on Cardano.
            </p>
          </div>
          
          <div className={styles.section}>
            <h4>Platform</h4>
            <ul className={styles.links}>
              <li><Link to="/jobs">Find Work</Link></li>
              <li><Link to="/jobs/post">Post a Job</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4>Support</h4>
            <ul className={styles.links}>
              <li><Link to="/help">Help Center</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4>Connect</h4>
            <ul className={styles.links}>
              <li><a href="#" target="_blank" rel="noreferrer">Twitter</a></li>
              <li><a href="#" target="_blank" rel="noreferrer">Discord</a></li>
              <li><a href="#" target="_blank" rel="noreferrer">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>&copy; {new Date().getFullYear()} BlockPay. All rights reserved.</p>
          <div className={styles.legal}>
            {/* Additional bottom links if needed */}
          </div>
        </div>
      </div>
    </footer>
  );
}
