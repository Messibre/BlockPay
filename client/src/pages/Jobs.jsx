import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Select from "../components/Select.jsx";
import Input from "../components/Input.jsx";
import Pagination from "../components/Pagination.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import api from "../services/api.js";
import styles from "./Jobs.module.css";

export default function Jobs() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    tag: "",
    experienceLevel: "",
    minBudget: "",
    maxBudget: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", filters, page],
    queryFn: () => api.getJobs({ ...filters, page, limit: 12 }),
    refetchInterval: 30000,
  });

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page when filters change
  };

  const handleSearch = (searchTerm) => {
    handleFilterChange("search", searchTerm);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      tag: "",
      experienceLevel: "",
      minBudget: "",
      maxBudget: "",
    });
    setPage(1);
  };

  const experienceOptions = [
    { value: "", label: "All Levels" },
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
    { value: "expert", label: "Expert" },
  ];

  return (
    <div className={styles.jobs}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Browse Jobs</h1>
          {user?.role === "client" && (
            <Link to="/jobs/post">
              <Button>Post a Job</Button>
            </Link>
          )}
        </div>

        <div className={styles.layoutGrid}>
          {/* Filters Sidebar */}
          <aside className={styles.filtersPanel}>
            <h3>Filters</h3>
            
            <div className={styles.searchSection}>
              <SearchBar
                placeholder="Search keywords..."
                onSearch={handleSearch}
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <Select
                label="Experience Level"
                options={experienceOptions}
                value={filters.experienceLevel}
                onChange={(e) =>
                  handleFilterChange("experienceLevel", e.target.value)
                }
              />
            </div>

            <div className={styles.filterGroup}>
              <Input
                label="Skill/Tag"
                type="text"
                placeholder="e.g. React"
                value={filters.tag}
                onChange={(e) => handleFilterChange("tag", e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <Input
                label="Min Budget (ADA)"
                type="number"
                placeholder="0"
                min="0"
                value={filters.minBudget}
                onChange={(e) => handleFilterChange("minBudget", e.target.value)}
              />
              <Input
                label="Max Budget (ADA)"
                type="number"
                placeholder="Any"
                min="0"
                value={filters.maxBudget}
                onChange={(e) => handleFilterChange("maxBudget", e.target.value)}
                style={{ marginTop: '0.5rem' }}
              />
            </div>

            <Button variant="ghost" onClick={clearFilters} className={styles.clearButton}>
              Clear All Filters
            </Button>
          </aside>

          {/* Jobs Grid */}
          <div className={styles.hasResults}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <LoadingSpinner size="large" />
                <p>Finding the best opportunities...</p>
              </div>
            ) : error ? (
              <div className={styles.error}>
                <p>Failed to load jobs. Please check your connection.</p>
              </div>
            ) : (
              <>
                <div className={styles.resultsHeader}>
                   <span className={styles.resultsCount}>
                    Found {data.pagination?.total || 0} jobs
                   </span>
                </div>

                {data?.jobs?.length > 0 ? (
                  <>
                    <div className={styles.jobGrid}>
                      {data.jobs.map((job) => (
                        <Link
                          key={job._id}
                          to={`/jobs/${job._id}`}
                          className={styles.jobCardLink}
                        >
                          <Card className={styles.jobCard}>
                            <div className={styles.jobHeader}>
                              <h3>{job.title}</h3>
                              <span className={styles.experienceBadge}>
                                {job.experienceLevel || "All Levels"}
                              </span>
                            </div>
                            
                            <p className={styles.description}>
                              {job.description.slice(0, 150)}
                              {job.description.length > 150 ? "..." : ""}
                            </p>

                            {job.tags && job.tags.length > 0 && (
                              <div className={styles.tags}>
                                {job.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className={styles.tag}>
                                    {tag}
                                  </span>
                                ))}
                                {job.tags.length > 3 && (
                                  <span className={styles.tag}>+{job.tags.length - 3}</span>
                                )}
                              </div>
                            )}

                            <div className={styles.cardFooter}>
                              <span className={styles.budget}>
                                {job.budgetMin / 1000000} - {job.budgetMax / 1000000} ADA
                              </span>
                              <span className={styles.postedDate}>
                                {new Date(job.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>

                    {data.pagination && data.pagination.pages > 1 && (
                      <Pagination
                        currentPage={page}
                        totalPages={data.pagination.pages}
                        onPageChange={setPage}
                      />
                    )}
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <h2>No jobs found</h2>
                    <p>Try adjusting your search criteria.</p>
                    {user?.role === "client" && (
                      <Link to="/jobs/post">
                        <Button>Post the First Job</Button>
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
