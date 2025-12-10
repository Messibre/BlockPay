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
import styles from "./MyContracts.module.css";

function MyContractsContent() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["myContracts", statusFilter],
    queryFn: () => api.getMyContracts(statusFilter),
  });

  const contracts = data?.contracts || [];

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "PENDING", label: "Pending" },
    { value: "FUNDED", label: "Funded" },
    { value: "ACTIVE", label: "Active" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading contracts...</p>
      </div>
    );
  }

  return (
    <div className={styles.myContracts}>
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            {
              label: "Dashboard",
              path:
                user?.role === "client"
                  ? "/dashboard/client"
                  : "/dashboard/freelancer",
            },
            { label: "My Contracts", path: "/contracts" },
          ]}
        />

        <div className={styles.header}>
          <h1>My Contracts</h1>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filter}
          />
        </div>

        {contracts.length === 0 ? (
          <Card className={styles.empty}>
            <h2>No contracts found</h2>
            <p>
              {statusFilter
                ? "No contracts match the selected filter."
                : "You don't have any contracts yet."}
            </p>
            {user?.role === "client" && (
              <Link to="/jobs/post">
                <Button>Post a Job</Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className={styles.contractsList}>
            {contracts.map((contract) => {
              const isClient =
                contract.clientId?._id?.toString() === user?.id?.toString() ||
                contract.clientId?.toString() === user?.id?.toString();
              const otherParty = isClient
                ? contract.freelancerId
                : contract.clientId;

              return (
                <Card key={contract._id} className={styles.contractCard}>
                  <div className={styles.contractHeader}>
                    <div>
                      <h3>{contract.projectId?.title || "Untitled Project"}</h3>
                      <p className={styles.party}>
                        {isClient ? "Freelancer" : "Client"}:{" "}
                        {otherParty?.fullName || otherParty?.email}
                      </p>
                    </div>
                    <span
                      className={`${styles.status} ${
                        styles[contract.offchainState?.toLowerCase()] || ""
                      }`}
                    >
                      {contract.offchainState || "Unknown"}
                    </span>
                  </div>

                  <div className={styles.contractInfo}>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Total Amount:</span>
                      <span className={styles.value}>
                        {contract.totalAmount / 1000000} ADA
                      </span>
                    </div>
                    {contract.milestones && contract.milestones.length > 0 && (
                      <div className={styles.infoRow}>
                        <span className={styles.label}>Milestones:</span>
                        <span className={styles.value}>
                          {contract.milestones.length}
                        </span>
                      </div>
                    )}
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Created:</span>
                      <span className={styles.value}>
                        {new Date(contract.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <Link to={`/contracts/${contract._id}`}>
                      <Button>View Details</Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyContracts() {
  return (
    <ProtectedRoute>
      <MyContractsContent />
    </ProtectedRoute>
  );
}
