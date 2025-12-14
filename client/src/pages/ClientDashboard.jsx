import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import api from "../services/api.js";
import styles from "./ClientDashboard.module.css";

function ClientDashboardContent() {
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Fetch dashboard stats from backend
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: api.getDashboardStats,
    initialData: {
      activeJobs: 0,
      pendingContracts: 0,
      completedContracts: 0,
      totalPaid: 0,
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) {
    console.error("Failed to load dashboard stats:", error);
    // Continue with initialData or show alert - for now just log
  }

  // Fetch notifications
  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 15000, // Poll every 15s
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const markReadMutation = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const handleMarkRead = (id) => {
    markReadMutation.mutate(id);
  };


  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Welcome back, {user?.displayName || user?.email}!</h1>
          <div className={styles.headerActions}>
            <Button onClick={() => setNotificationsOpen(!notificationsOpen)}>
              Notifications ({unreadCount})
            </Button>
            <Link to="/jobs/post">
              <Button>Post New Job</Button>
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
                  <li key={notif._id} className={`${styles.notificationItem} ${!notif.isRead ? styles.unread : ''}`}>
                    <div style={{ flex: 1 }}>
                        <p><strong>{notif.title}</strong></p>
                        <p>{notif.message}</p>
                        <span className={styles.time}>{new Date(notif.createdAt).toLocaleString()}</span>
                    </div>
                    {!notif.isRead && (
                        <Button 
                            variant="text" 
                            size="small" 
                            onClick={() => handleMarkRead(notif._id)}
                            style={{ marginLeft: '10px', fontSize: '0.8rem' }}
                        >
                            Mark Read
                        </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <h3>Active Jobs</h3>
            <div className={styles.statValue}>{stats.activeJobs}</div>
            <Link to="/jobs">View all jobs</Link>
          </Card>

          <Card className={styles.statCard}>
            <h3>Pending Contracts</h3>
            <div className={styles.statValue}>{stats.pendingContracts}</div>
            <Link to="/contracts">View contracts</Link>
          </Card>

          <Card className={styles.statCard}>
            <h3>Completed Contracts</h3>
            <div className={styles.statValue}>{stats.completedContracts}</div>
            <Link to="/contracts">View history</Link>
          </Card>

          <Card className={styles.statCard}>
            <h3>Total Paid</h3>
            <div className={styles.statValue}>{stats.totalPaid} ADA</div>
            <Link to="/contracts">View transactions</Link>
          </Card>
        </div>

        <div className={styles.quickActions}>
          <h2>Quick Actions</h2>
          <div className={styles.actionsGrid}>
            <Link to="/jobs/post">
              <Card className={styles.actionCard}>
                <h3>Post New Job</h3>
                <p>Create a new job posting</p>
              </Card>
            </Link>
            <Link to="/freelancers">
              <Card className={styles.actionCard}>
                <h3>View Freelancers</h3>
                <p>Browse available freelancers</p>
              </Card>
            </Link>
            <Link to="/contracts">
              <Card className={styles.actionCard}>
                <h3>Manage Contracts</h3>
                <p>View and manage your contracts</p>
              </Card>
            </Link>
            <Link to="/payments">
              <Card className={styles.actionCard}>
                <h3>Payments</h3>
                <p>Deposit funds and manage payments</p>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  return (
    <ProtectedRoute requiredRole="client">
      <ClientDashboardContent />
    </ProtectedRoute>
  );
}
