import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import styles from "./FreelancerDashboard.module.css";

function FreelancerDashboardContent() {
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Show empty stats and no notifications by default
  const stats = {
    jobsRecommended: 0,
    activeContracts: 0,
    pendingProposals: 0,
    totalEarnings: 0,
  };

  const notifications = [];

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Welcome back, {user?.displayName || user?.email}!</h1>
          <div className={styles.headerActions}>
            <Button onClick={() => setNotificationsOpen(!notificationsOpen)}>
              Notifications ({notifications.length})
            </Button>
            <Link to="/jobs">
              <Button>Browse Jobs</Button>
            </Link>
          </div>
        </div>

        {notificationsOpen && (
          <Card className={styles.notifications}>
            <h3>Notifications</h3>
            {notifications.length === 0 ? (
              <p className={styles.empty}>No notifications</p>
            ) : (
              <ul className={styles.notificationList}>
                {notifications.map((notif) => (
                  <li key={notif.id} className={styles.notificationItem}>
                    <p>{notif.message}</p>
                    <span className={styles.time}>{notif.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <h3>Jobs Recommended</h3>
            <div className={styles.statValue}>{stats.jobsRecommended}</div>
            <Link to="/jobs">Browse all jobs</Link>
          </Card>

          <Card className={styles.statCard}>
            <h3>Active Contracts</h3>
            <div className={styles.statValue}>{stats.activeContracts}</div>
            <Link to="/contracts">View contracts</Link>
          </Card>

          <Card className={styles.statCard}>
            <h3>Pending Proposals</h3>
            <div className={styles.statValue}>{stats.pendingProposals}</div>
            <Link to="/proposals">View my proposals</Link>
          </Card>

          <Card className={styles.statCard}>
            <h3>Total Earnings</h3>
            <div className={styles.statValue}>{stats.totalEarnings} ADA</div>
            <Link to="/contracts">View earnings</Link>
          </Card>
        </div>

        <div className={styles.sections}>
          <div className={styles.section}>
            <h2>Recent Payments</h2>
            <Card>
              <p className={styles.empty}>No recent payments</p>
            </Card>
          </div>

          <div className={styles.section}>
            <h2>Messages</h2>
            <Card>
              <p className={styles.empty}>No new messages</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FreelancerDashboard() {
  return (
    <ProtectedRoute requiredRole="freelancer">
      <FreelancerDashboardContent />
    </ProtectedRoute>
  );
}
