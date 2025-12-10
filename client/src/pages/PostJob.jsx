import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import api from "../services/api.js";
import styles from "./PostJob.module.css";

export default function PostJob() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: [],
    budgetMin: "",
    budgetMax: "",
    deadline: "",
    experienceLevel: "intermediate",
    file: null,
  });
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!isAuthenticated) {
      setError("Please login to post a job");
      showError("Please login to post a job");
      setIsSubmitting(false);
      return;
    }

    try {
      const jobData = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
        budgetMin: Number(formData.budgetMin) * 1000000, // Convert ADA to lovelace
        budgetMax: Number(formData.budgetMax) * 1000000,
        deadline: formData.deadline,
        experienceLevel: formData.experienceLevel,
        status: isDraft ? "draft" : "open",
      };

      const response = await api.createJob(jobData);
      const jobId = response.job?._id || response.jobId || response._id;
      success(isDraft ? "Job saved as draft" : "Job posted successfully!");
      navigate(`/jobs/${jobId}`);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to post job";
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.postJob}>
        <div className={styles.container}>
          <div className={styles.error}>
            Please <a href="/login">login</a> to post a job.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postJob}>
      <div className={styles.container}>
        <h1>Post a New Job</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label>Job Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., React Developer Needed"
              required
            />
          </div>

          <div className={styles.field}>
            <label>Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the job requirements, deliverables, and expectations..."
              rows={8}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Required Skills</label>
            <div className={styles.tagInput}>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a skill and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className={styles.addTagBtn}
              >
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className={styles.tags}>
                {formData.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className={styles.removeTag}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Minimum Budget (ADA) *</label>
              <input
                type="number"
                value={formData.budgetMin}
                onChange={(e) =>
                  setFormData({ ...formData, budgetMin: e.target.value })
                }
                min="0"
                step="0.1"
                required
              />
            </div>

            <div className={styles.field}>
              <label>Maximum Budget (ADA) *</label>
              <input
                type="number"
                value={formData.budgetMax}
                onChange={(e) =>
                  setFormData({ ...formData, budgetMax: e.target.value })
                }
                min="0"
                step="0.1"
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Experience Level *</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) =>
                  setFormData({ ...formData, experienceLevel: e.target.value })
                }
                required
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Deadline *</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) =>
                  setFormData({ ...formData, deadline: e.target.value })
                }
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Attachments (Optional)</label>
            <input
              type="file"
              onChange={(e) =>
                setFormData({ ...formData, file: e.target.files[0] })
              }
              accept=".pdf,.doc,.docx,.txt"
            />
            <small>
              Upload project brief, requirements, or reference files (PDF, DOC,
              TXT)
            </small>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                setIsDraft(true);
                handleSubmit({ preventDefault: () => {} });
              }}
              className={styles.buttonDraft}
              disabled={isSubmitting}
            >
              Save as Draft
            </button>
            <button
              type="submit"
              className={styles.button}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Posting..." : "Post Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
