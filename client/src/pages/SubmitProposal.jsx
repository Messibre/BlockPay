import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useWallet } from "@meshsdk/react";
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
  const { address: connectedAddress, wallet } = useWallet();
  const [isLinking, setIsLinking] = useState(false);
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState({
    coverLetter: "",
    bidAmount: "",
    timeline: "",
    portfolioLinks: "",
    preferredPaymentAddress: "",
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

      let preferred = formData.preferredPaymentAddress || null;
      if (preferred === "__connected__") preferred = connectedAddress || null;

      // Validate preferred address format if provided
      const isBech32 = (s) =>
        typeof s === "string" && /^(addr1|addr_test1)[0-9a-z]+$/.test(s);
      if (preferred && !isBech32(preferred)) {
        throw new Error("Invalid preferred payment address");
      }

      const proposalData = {
        coverLetter: formData.coverLetter,
        bidAmount: Number(formData.bidAmount) * 1000000, // Convert ADA to lovelace
        timeline: formData.timeline,
        portfolioLinks: portfolioLinksArray,
        preferredPaymentAddress: preferred || null,
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

            <div className={styles.row}>
              <label className={styles.label}>Preferred payout wallet</label>
              <select
                value={formData.preferredPaymentAddress}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredPaymentAddress: e.target.value,
                  })
                }
              >
                <option value="">Use registered/default wallet</option>
                {user?.wallets?.map((w) => (
                  <option key={w.address} value={w.address}>
                    {w.address}
                  </option>
                ))}
                {user?.walletAddress && (
                  <option value={user.walletAddress}>
                    {user.walletAddress} (primary)
                  </option>
                )}
                <option value="__connected__">
                  Use currently connected wallet
                </option>
              </select>
              {formData.preferredPaymentAddress === "__connected__" &&
                connectedAddress &&
                !(user?.wallets || []).some(
                  (w) => w.address === connectedAddress
                ) &&
                user?.walletAddress !== connectedAddress && (
                  <div className={styles.linkHint}>
                    <p className={styles.helpText}>
                      Connected wallet is not linked to your account. You must
                      link it before using it as a payout address.
                    </p>
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          setIsLinking(true);
                          const message = `Link blockPay account at ${Date.now()}`;
                          const encoder = new TextEncoder();
                          const payloadHex = Array.from(encoder.encode(message))
                            .map((b) => b.toString(16).padStart(2, "0"))
                            .join("");
                          let signature = null;
                          if (wallet && wallet.signData) {
                            const sigObj = await wallet.signData(
                              connectedAddress,
                              payloadHex
                            );
                            signature = sigObj?.signature || sigObj;
                          } else if (window.cardano && window.cardano.enable) {
                            const enabled = await window.cardano.enable();
                            const sigObj = await enabled.signData(
                              connectedAddress,
                              payloadHex
                            );
                            signature = sigObj?.signature || sigObj;
                          }
                          if (!signature)
                            throw new Error(
                              "Wallet does not support message signing here. Use the Wallet modal to link instead."
                            );
                          const res = await api.verifyWallet(
                            connectedAddress,
                            signature,
                            message
                          );
                          localStorage.setItem("token", res.token);
                          window.location.reload();
                        } catch (e) {
                          console.error("Link failed", e);
                          showError(
                            e.response?.data?.message ||
                              e.message ||
                              "Failed to link wallet"
                          );
                        } finally {
                          setIsLinking(false);
                        }
                      }}
                      disabled={isLinking}
                    >
                      {isLinking ? "Linking..." : "Link connected wallet"}
                    </Button>
                  </div>
                )}
            </div>

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
