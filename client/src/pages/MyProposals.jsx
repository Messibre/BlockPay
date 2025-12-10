import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Select from "../components/Select.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import api from "../services/api.js";
import styles from "./MyProposals.module.css";

function MyProposalsContent() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["myProposals", statusFilter],
    queryFn: () => api.getMyProposals(statusFilter),
  });

  const proposals = data?.proposals || [];

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
  ];

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading proposals...</p>
      </div>
    );
  }

  return (
    <div className={styles.myProposals}>
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            { label: "Dashboard", path: "/dashboard/freelancer" },
            { label: "My Proposals", path: "/proposals" },
          ]}
        />

        <div className={styles.header}>
          <h1>My Proposals</h1>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filter}
          />
        </div>

        {proposals.length === 0 ? (
          <Card className={styles.empty}>
            <h2>No proposals found</h2>
            <p>
              {statusFilter
                ? "No proposals match the selected filter."
                : "You haven't submitted any proposals yet."}
            </p>
            <Link to="/jobs">
              <Button>Browse Jobs</Button>
            </Link>
          </Card>
        ) : (
          <div className={styles.proposalsList}>
            {proposals.map((proposal) => (
              <Card key={proposal._id} className={styles.proposalCard}>
                <div className={styles.proposalHeader}>
                  <div>
                    <h3>{proposal.jobId?.title || "Job"}</h3>
                    <p className={styles.bid}>
                      Bid: <strong>{proposal.bidAmount / 1000000} ADA</strong>
                    </p>
                    {proposal.timeline && (
                      <p className={styles.timeline}>
                        Timeline: {proposal.timeline}
                      </p>
                    )}
                  </div>
                  <span
                    className={`${styles.status} ${styles[proposal.status]}`}
                  >
                    {proposal.status}
                  </span>
                </div>

                <div className={styles.proposalContent}>
                  <p className={styles.coverLetter}>
                    {proposal.coverLetter.slice(0, 200)}
                    {proposal.coverLetter.length > 200 ? "..." : ""}
                  </p>

                  <div className={styles.meta}>
                    <span className={styles.date}>
                      Submitted:{" "}
                      {new Date(proposal.createdAt).toLocaleDateString()}
                    </span>
                    {proposal.jobId?.status && (
                      <span className={styles.jobStatus}>
                        Job Status: {proposal.jobId.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.actions}>
                  <Link to={`/jobs/${proposal.jobId?._id}`}>
                    <Button variant="secondary">View Job</Button>
                  </Link>
                  {proposal.status === "accepted" && proposal.contractId && (
                    <Link to={`/contracts/${proposal.contractId}`}>
                      <Button>View Contract</Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyProposals() {
  return (
    <ProtectedRoute requiredRole="freelancer">
      <MyProposalsContent />
    </ProtectedRoute>
  );
}
