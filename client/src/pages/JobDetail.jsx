import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import api from "../services/api.js";
import styles from "./JobDetail.module.css";

export default function JobDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.getJob(id),
  });

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className={styles.error}>
        <h2>Job not found</h2>
        <p>The job you're looking for doesn't exist or has been removed.</p>
        <Link to="/jobs">
          <Button>Browse Jobs</Button>
        </Link>
      </div>
    );
  }

  const canApply =
    isAuthenticated && user?.role === "freelancer" && job.status === "open";

  return (
    <div className={styles.jobDetail}>
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            { label: "Jobs", path: "/jobs" },
            { label: job.title, path: `/jobs/${id}` },
          ]}
        />

        <Card>
          <div className={styles.header}>
            <div>
              <h1>{job.title}</h1>
              <div className={styles.meta}>
                <span className={styles.status}>{job.status}</span>
                {job.experienceLevel && (
                  <span className={styles.experience}>
                    {job.experienceLevel}
                  </span>
                )}
              </div>
            </div>
            {canApply && (
              <Link to={`/jobs/${id}/apply`}>
                <Button size="large">Apply Now</Button>
              </Link>
            )}
            {user?.role === "client" && job.status === "open" && (
              <Link to={`/jobs/${id}/manage`}>
                <Button variant="secondary" size="large">
                  Manage Job
                </Button>
              </Link>
            )}
          </div>

          <div className={styles.budget}>
            <strong>
              Budget: {job.budgetMin / 1000000} - {job.budgetMax / 1000000} ADA
            </strong>
            {job.deadline && (
              <span className={styles.deadline}>
                Deadline: {new Date(job.deadline).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className={styles.content}>
            <h2>Description</h2>
            <p className={styles.description}>{job.description}</p>

            {job.tags && job.tags.length > 0 && (
              <div className={styles.tagsSection}>
                <h3>Required Skills</h3>
                <div className={styles.tags}>
                  {job.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.footer}>
              <span className={styles.postedDate}>
                Posted: {new Date(job.createdAt).toLocaleDateString()}
              </span>
              {job.clientId && (
                <span className={styles.clientInfo}>
                  Posted by: {job.clientId}
                </span>
              )}
            </div>
          </div>
        </Card>

        {!isAuthenticated && (
          <Card className={styles.authPrompt}>
            <h3>Want to apply for this job?</h3>
            <p>Sign up or log in to submit a proposal.</p>
            <div className={styles.authActions}>
              <Link to="/register">
                <Button>Sign Up</Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary">Login</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
