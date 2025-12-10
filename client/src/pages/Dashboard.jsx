import { useAuth } from "../contexts/AuthContext.jsx";
import { Navigate } from "react-router-dom";
import Card from "../components/Card.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to role-specific dashboard
  if (user?.role === "client") {
    return <Navigate to="/dashboard/client" replace />;
  } else if (user?.role === "freelancer") {
    return <Navigate to="/dashboard/freelancer" replace />;
  }

  return <Navigate to="/" replace />;
}
