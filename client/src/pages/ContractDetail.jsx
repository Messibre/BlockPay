import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import api from "../services/api.js";
import styles from "./ContractDetail.module.css";

export default function ContractDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const {
    data: contract,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => api.getContract(id),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading contract details...</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className={styles.errorContainer}>
        <h2>Contract not found</h2>
        <p>
          {error?.response?.status === 404
            ? "This contract doesn't exist or has been removed."
            : "Unable to load contract. Please try again later."}
        </p>
        <Link to="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const isClient = user?.role === "client";
  const isFreelancer = user?.role === "freelancer";

  return (
    <div className={styles.contractDetail}>
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            {
              label: "Dashboard",
              path: isClient ? "/dashboard/client" : "/dashboard/freelancer",
            },
            { label: `Contract #${id.slice(0, 8)}`, path: `/contracts/${id}` },
          ]}
        />

        <Card>
          <h1>Contract Details</h1>
          <div className={styles.info}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Contract ID:</span>
              <span className={styles.value}>{id}</span>
            </div>
            {contract.contractAddress && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Contract Address:</span>
                <span className={styles.value}>
                  <code>{contract.contractAddress}</code>
                </span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.label}>Status:</span>
              <span
                className={`${styles.status} ${
                  styles[contract.offchainState?.toLowerCase()] || ""
                }`}
              >
                {contract.offchainState || "Unknown"}
              </span>
            </div>
            {contract.totalAmount && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Total Amount:</span>
                <span className={styles.value}>
                  <strong>{contract.totalAmount / 1000000} ADA</strong>
                </span>
              </div>
            )}
          </div>

          {contract.milestones && contract.milestones.length > 0 && (
            <div className={styles.milestones}>
              <h2>Milestones</h2>
              <div className={styles.milestoneList}>
                {contract.milestones.map((milestone) => (
                  <Card key={milestone.id} className={styles.milestone}>
                    <div className={styles.milestoneHeader}>
                      <h3>{milestone.title}</h3>
                      <span className={styles.milestoneStatus}>
                        {milestone.status}
                      </span>
                    </div>
                    <p className={styles.milestoneAmount}>
                      Amount: {milestone.amount / 1000000} ADA
                    </p>
                    {milestone.dueDate && (
                      <p className={styles.milestoneDue}>
                        Due: {new Date(milestone.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    {isFreelancer && milestone.status === "PENDING" && (
                      <Button
                        variant="primary"
                        className={styles.actionButton}
                        onClick={() => {
                          // TODO: Implement milestone submission
                          alert("Milestone submission coming soon!");
                        }}
                      >
                        Submit Work
                      </Button>
                    )}
                    {isClient && milestone.status === "SUBMITTED" && (
                      <Button
                        variant="success"
                        className={styles.actionButton}
                        onClick={() => {
                          // TODO: Implement milestone approval
                          alert("Milestone approval coming soon!");
                        }}
                      >
                        Approve & Pay
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className={styles.authPrompt}>
              <p>Please log in to view contract details.</p>
              <Link to="/login">
                <Button>Login</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
