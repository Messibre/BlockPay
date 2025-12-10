import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Modal from "../components/Modal.jsx";
import Input from "../components/Input.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import api from "../services/api.js";
import styles from "./ManageJob.module.css";

export default function ManageJob() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [milestones, setMilestones] = useState([
    { title: "", amount: "", dueDate: "" },
  ]);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId),
  });

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery({
    queryKey: ["proposals", jobId],
    queryFn: () => api.getProposals(jobId),
    enabled: !!jobId,
  });

  const acceptMutation = useMutation({
    mutationFn: (data) => api.acceptProposal(selectedProposal?._id, data),
    onSuccess: (data) => {
      success("Proposal accepted! Contract created.");
      queryClient.invalidateQueries(["proposals", jobId]);
      queryClient.invalidateQueries(["job", jobId]);
      setShowAcceptModal(false);
      navigate(`/contracts/${data.contractId}`);
    },
    onError: (err) => {
      showError(err.response?.data?.message || "Failed to accept proposal");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (proposalId) => api.rejectProposal(proposalId),
    onSuccess: () => {
      success("Proposal rejected");
      queryClient.invalidateQueries(["proposals", jobId]);
    },
    onError: (err) => {
      showError(err.response?.data?.message || "Failed to reject proposal");
    },
  });

  const handleAccept = (proposal) => {
    setSelectedProposal(proposal);
    // Pre-fill milestones based on proposal bid
    const defaultMilestone = {
      title: "Complete project",
      amount: (proposal.bidAmount / 1000000).toString(),
      dueDate: "",
    };
    setMilestones([defaultMilestone]);
    setShowAcceptModal(true);
  };

  const handleSubmitAccept = (e) => {
    e.preventDefault();
    const totalAmount = milestones.reduce(
      (sum, m) => sum + Number(m.amount) * 1000000,
      0
    );

    if (totalAmount !== selectedProposal.bidAmount) {
      showError("Milestone sum must equal proposal bid amount");
      return;
    }

    const milestoneData = milestones.map((m, index) => ({
      id: `milestone_${Date.now()}_${index}`,
      title: m.title,
      description: "",
      amount: Number(m.amount) * 1000000,
      dueDate: m.dueDate || null,
    }));

    acceptMutation.mutate({ milestones: milestoneData });
  };

  const addMilestone = () => {
    setMilestones([...milestones, { title: "", amount: "", dueDate: "" }]);
  };

  const removeMilestone = (index) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  if (jobLoading || proposalsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading...</p>
      </div>
    );
  }

  const proposals = proposalsData?.proposals || [];

  return (
    <div className={styles.manageJob}>
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            { label: "Jobs", path: "/jobs" },
            { label: job?.title || "Job", path: `/jobs/${jobId}` },
            { label: "Manage", path: `/jobs/${jobId}/manage` },
          ]}
        />

        <Card>
          <div className={styles.header}>
            <h1>Manage Job: {job?.title}</h1>
            <Link to={`/jobs/${jobId}`}>
              <Button variant="secondary">View Job</Button>
            </Link>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Status:</span>
              <span className={styles.statValue}>{job?.status}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Proposals:</span>
              <span className={styles.statValue}>{proposals.length}</span>
            </div>
          </div>
        </Card>

        <Card className={styles.proposalsSection}>
          <h2>Received Proposals</h2>
          {proposals.length === 0 ? (
            <div className={styles.empty}>
              <p>No proposals received yet.</p>
            </div>
          ) : (
            <div className={styles.proposalsList}>
              {proposals.map((proposal) => (
                <Card key={proposal._id} className={styles.proposalCard}>
                  <div className={styles.proposalHeader}>
                    <div>
                      <h3>
                        {proposal.freelancerId?.fullName ||
                          proposal.freelancerId?.email}
                      </h3>
                      <p className={styles.proposalBid}>
                        Bid: <strong>{proposal.bidAmount / 1000000} ADA</strong>
                      </p>
                      {proposal.timeline && (
                        <p className={styles.proposalTimeline}>
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
                    <p className={styles.coverLetter}>{proposal.coverLetter}</p>

                    {proposal.portfolioLinks &&
                      proposal.portfolioLinks.length > 0 && (
                        <div className={styles.portfolioLinks}>
                          <strong>Portfolio:</strong>
                          {proposal.portfolioLinks.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.link}
                            >
                              {link}
                            </a>
                          ))}
                        </div>
                      )}

                    <div className={styles.proposalMeta}>
                      <span className={styles.date}>
                        Submitted:{" "}
                        {new Date(proposal.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {proposal.status === "pending" && (
                    <div className={styles.proposalActions}>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to reject this proposal?"
                            )
                          ) {
                            rejectMutation.mutate(proposal._id);
                          }
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => handleAccept(proposal)}
                      >
                        Accept & Create Contract
                      </Button>
                    </div>
                  )}

                  {proposal.status === "accepted" && proposal.contractId && (
                    <div className={styles.contractLink}>
                      <Link to={`/contracts/${proposal.contractId}`}>
                        <Button variant="secondary">View Contract</Button>
                      </Link>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>

        <Modal
          isOpen={showAcceptModal}
          onClose={() => setShowAcceptModal(false)}
          title="Accept Proposal & Create Contract"
          size="large"
        >
          <form onSubmit={handleSubmitAccept}>
            <div className={styles.proposalSummary}>
              <p>
                <strong>Freelancer:</strong>{" "}
                {selectedProposal?.freelancerId?.fullName ||
                  selectedProposal?.freelancerId?.email}
              </p>
              <p>
                <strong>Bid Amount:</strong>{" "}
                {selectedProposal?.bidAmount / 1000000} ADA
              </p>
            </div>

            <h3>Milestones</h3>
            <p className={styles.helpText}>
              Define milestones that sum to the proposal bid amount.
            </p>

            {milestones.map((milestone, index) => (
              <Card key={index} className={styles.milestoneForm}>
                <div className={styles.milestoneHeader}>
                  <h4>Milestone {index + 1}</h4>
                  {milestones.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="small"
                      onClick={() => removeMilestone(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  label="Title *"
                  value={milestone.title}
                  onChange={(e) =>
                    updateMilestone(index, "title", e.target.value)
                  }
                  required
                />
                <Input
                  label="Amount (ADA) *"
                  type="number"
                  value={milestone.amount}
                  onChange={(e) =>
                    updateMilestone(index, "amount", e.target.value)
                  }
                  min="0"
                  step="0.1"
                  required
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={milestone.dueDate}
                  onChange={(e) =>
                    updateMilestone(index, "dueDate", e.target.value)
                  }
                />
              </Card>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={addMilestone}
              className={styles.addMilestoneBtn}
            >
              + Add Milestone
            </Button>

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAcceptModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={acceptMutation.isPending}>
                {acceptMutation.isPending
                  ? "Creating Contract..."
                  : "Accept & Create Contract"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
