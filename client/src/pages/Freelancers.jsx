import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import BackButton from "../components/BackButton.jsx";
import Input from "../components/Input.jsx";
import api from "../services/api.js";
import styles from "./ClientDashboard.module.css"; // Reuse dashboard styles for consistency

export default function Freelancers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    data: freelancers,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["freelancers", debouncedSearch],
    queryFn: () => api.getUsers({ role: "freelancer", search: debouncedSearch }),
  });

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        <BackButton label="Back to Dashboard" />
        <div className={styles.header}>
          <h1>Find Freelancers</h1>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className={styles.error}>
            Failed to load freelancers. Please try again.
          </div>
        ) : freelancers && freelancers.length > 0 ? (
          <div
            className={styles.statsGrid}
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
          >
            {freelancers.map((freelancer) => (
              <Card key={freelancer._id} className={styles.statCard}>
                <h3>{freelancer.fullName}</h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
                   {freelancer.email || "No email provided"}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginBottom: "1.5rem",
                  }}
                >
                  {freelancer.skills && freelancer.skills.length > 0 ? (
                    freelancer.skills.map((skill) => (
                      <span
                        key={skill}
                        style={{
                          background: "var(--bg-tertiary)",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "20px",
                          fontSize: "0.85rem",
                        }}
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
                      No skills listed
                    </span>
                  )}
                </div>
                 {freelancer.rating > 0 && (
                    <div style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>
                        {'★'.repeat(Math.round(freelancer.rating))} 
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            ({freelancer.rating})
                        </span>
                    </div>
                 )}
                <Button onClick={() => alert("Invite feature coming soon!")}>
                  Invite to Job
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>No freelancers found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
