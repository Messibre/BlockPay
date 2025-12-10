import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Card from "../components/Card.jsx";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import api from "../services/api.js";
import styles from "./SubmitProposal.module.css";

function SubmitProposalContent() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState({
    coverLetter: "",
    bidAmount: "",
    timeline: "",
    portfolioLinks: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const portfolioLinksArray = formData.portfolioLinks
        .split(",")
        .map((link) => link.trim())
        .filter((link) => link.length > 0);

      const proposalData = {
        coverLetter: formData.coverLetter,
        bidAmount: Number(formData.bidAmount) * 1000000, // Convert ADA to lovelace
        timeline: formData.timeline,
        portfolioLinks: portfolioLinksArray,
      };

      await api.submitProposal(jobId, proposalData);
      success("Proposal submitted successfully!");
      navigate(`/jobs/${jobId}`);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || "Failed to submit proposal";
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (jobLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading job details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.errorContainer}>
        <h2>Job not found</h2>
        <Link to="/jobs">
          <Button>Browse Jobs</Button>
        </Link>
      </div>
    );
  }

  const minBudgetADA = job.budgetMin / 1000000;
  const maxBudgetADA = job.budgetMax / 1000000;

  return (
    <div className={styles.submitProposal}>
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            { label: "Jobs", path: "/jobs" },
            { label: job.title, path: `/jobs/${jobId}` },
            { label: "Submit Proposal", path: `/jobs/${jobId}/apply` },
          ]}
        />

        <Card>
          <h1>Submit Proposal</h1>
          <div className={styles.jobInfo}>
            <h2>{job.title}</h2>
            <p className={styles.budget}>
              Budget: {minBudgetADA} - {maxBudgetADA} ADA
            </p>
            <p className={styles.description}>
              {job.description.slice(0, 200)}...
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Cover Letter *"
              type="textarea"
              value={formData.coverLetter}
              onChange={(e) =>
                setFormData({ ...formData, coverLetter: e.target.value })
              }
              placeholder="Explain why you're the best fit for this job, your relevant experience, and how you'll approach the project..."
              required
              rows={8}
            />

            <div className={styles.row}>
              <Input
                label={`Bid Amount (ADA) *`}
                type="number"
                value={formData.bidAmount}
                onChange={(e) =>
                  setFormData({ ...formData, bidAmount: e.target.value })
                }
                placeholder={`Between ${minBudgetADA} and ${maxBudgetADA} ADA`}
                min={minBudgetADA}
                max={maxBudgetADA}
                step="0.1"
                required
              />

              <Input
                label="Timeline"
                type="text"
                value={formData.timeline}
                onChange={(e) =>
                  setFormData({ ...formData, timeline: e.target.value })
                }
                placeholder="e.g., 2 weeks, 1 month"
              />
            </div>

            <Input
              label="Portfolio Links (comma-separated)"
              type="text"
              value={formData.portfolioLinks}
              onChange={(e) =>
                setFormData({ ...formData, portfolioLinks: e.target.value })
              }
              placeholder="https://portfolio.com, https://github.com/username"
            />

            <div className={styles.actions}>
              <Link to={`/jobs/${jobId}`}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Proposal"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function SubmitProposal() {
  return (
    <ProtectedRoute requiredRole="freelancer">
      <SubmitProposalContent />
    </ProtectedRoute>
  );
}
