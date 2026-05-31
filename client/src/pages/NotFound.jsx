import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import styles from './NotFound.module.css';

export default function NotFound() {
  return (
    <div className={styles.notFound}>
      <div className={styles.content}>
        <div className={styles.errorCode}>404</div>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.description}>
          The page you are looking for does not exist or has been moved.
          Let us help you find your way back.
        </p>
        <div className={styles.actions}>
          <Link to="/">
            <Button variant="primary" size="large">
              Go Home
            </Button>
          </Link>
          <Link to="/jobs">
            <Button variant="secondary" size="large">
              Browse Jobs
            </Button>
          </Link>
        </div>
      </div>
      <div className={styles.decoration} aria-hidden="true">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="var(--color-primary-glow)" d="M44.5,-76.3C56.9,-69.1,65.6,-55.6,72.4,-41.5C79.2,-27.5,84.1,-13.7,83.4,-0.4C82.7,12.9,76.4,25.8,68.3,37.3C60.2,48.7,50.4,58.6,38.7,65.7C27,72.8,13.5,77,-0.8,78.4C-15.1,79.8,-30.2,78.3,-42.9,72C-55.6,65.7,-65.9,54.6,-73.1,41.8C-80.3,29,-84.4,14.5,-83.8,0.3C-83.2,-13.8,-77.9,-27.7,-70.1,-40C-62.3,-52.3,-52,-63.1,-39.6,-70.3C-27.2,-77.5,-13.6,-81.1,1.1,-82.9C15.8,-84.8,31.6,-84.8,44.5,-76.3Z" transform="translate(100 100)" />
        </svg>
      </div>
    </div>
  );
}
