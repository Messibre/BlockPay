import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext.jsx";
import Card from "../components/Card.jsx";
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
              <button className={styles.postButton}>Post a Job</button>
            </Link>
          )}
        </div>

        <div className={styles.filtersSection}>
          <div className={styles.searchSection}>
            <SearchBar
              placeholder="Search jobs by title or description..."
              onSearch={handleSearch}
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <Input
              label="Skill/Tag"
              type="text"
              placeholder="e.g., React, Node.js"
              value={filters.tag}
              onChange={(e) => handleFilterChange("tag", e.target.value)}
            />

            <Select
              label="Experience Level"
              options={experienceOptions}
              value={filters.experienceLevel}
              onChange={(e) =>
                handleFilterChange("experienceLevel", e.target.value)
              }
            />

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
            />

            <button onClick={clearFilters} className={styles.clearButton}>
              Clear Filters
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <LoadingSpinner size="large" />
            <p>Loading jobs...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>Error loading jobs. Please try again later.</p>
          </div>
        ) : (
          <>
            {data?.jobs?.length > 0 ? (
              <>
                <div className={styles.resultsInfo}>
                  <p>
                    Showing {data.jobs.length} of {data.pagination?.total || 0}{" "}
                    jobs
                  </p>
                </div>
                <div className={styles.jobList}>
                  {data.jobs.map((job) => (
                    <Link
                      key={job._id}
                      to={`/jobs/${job._id}`}
                      className={styles.jobCard}
                    >
                      <Card>
                        <div className={styles.jobHeader}>
                          <h3>{job.title}</h3>
                          <span className={styles.experience}>
                            {job.experienceLevel || "Any"}
                          </span>
                        </div>
                        <p className={styles.description}>
                          {job.description.slice(0, 200)}
                          {job.description.length > 200 ? "..." : ""}
                        </p>
                        <div className={styles.meta}>
                          <div className={styles.budget}>
                            <strong>
                              {job.budgetMin / 1000000} -{" "}
                              {job.budgetMax / 1000000} ADA
                            </strong>
                          </div>
                          {job.deadline && (
                            <div className={styles.deadline}>
                              Deadline:{" "}
                              {new Date(job.deadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {job.tags && job.tags.length > 0 && (
                          <div className={styles.tags}>
                            {job.tags.map((tag) => (
                              <span key={tag} className={styles.tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={styles.footer}>
                          <span className={styles.postedDate}>
                            Posted{" "}
                            {new Date(job.createdAt).toLocaleDateString()}
                          </span>
                          <button className={styles.viewButton}>
                            View Details →
                          </button>
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
              <div className={styles.empty}>
                <h2>No jobs found</h2>
                <p>Try adjusting your filters or check back later.</p>
                {user?.role === "client" && (
                  <Link to="/jobs/post">
                    <button className={styles.postButton}>
                      Post the First Job
                    </button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
