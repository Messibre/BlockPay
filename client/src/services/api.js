import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      // Only redirect if not already on login/register page
      if (
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default {
  // Auth
  register: (data) => api.post("/auth/register", data).then((res) => res.data),
  login: (email, password) =>
    api.post("/auth/login", { email, password }).then((res) => res.data),
  verifyWallet: (address, signature, message) =>
    api
      .post("/auth/wallet/verify", { address, signature, message })
      .then((res) => res.data),
  getMe: () => api.get("/auth/me").then((res) => res.data),

  // Jobs
  getJobs: (filters = {}) =>
    api.get("/jobs", { params: filters }).then((res) => res.data),
  getJob: (id) => api.get(`/jobs/${id}`).then((res) => res.data),
  createJob: (data) => api.post("/jobs", data).then((res) => res.data),

  // Contracts
  createContract: (data) =>
    api.post("/contracts", data).then((res) => res.data),
  getContract: (id) => api.get(`/contracts/${id}`).then((res) => res.data),
  getMyContracts: (status) =>
    api.get("/contracts", { params: { status } }).then((res) => res.data),
  recordDeposit: (id, txHash, amount) =>
    api
      .post(`/contracts/${id}/deposit`, { txHash, amount })
      .then((res) => res.data),
  getDeposits: (id) =>
    api.get(`/contracts/${id}/deposits`).then((res) => res.data),

  // Proposals
  submitProposal: (jobId, data) =>
    api.post(`/jobs/${jobId}/proposals`, data).then((res) => res.data),
  getProposals: (jobId) =>
    api.get(`/jobs/${jobId}/proposals`).then((res) => res.data),
  getMyProposals: (status) =>
    api
      .get("/jobs/proposals/my", { params: { status } })
      .then((res) => res.data),
  acceptProposal: (proposalId, data) =>
    api.post(`/proposals/${proposalId}/accept`, data).then((res) => res.data),
  rejectProposal: (proposalId) =>
    api.post(`/proposals/${proposalId}/reject`).then((res) => res.data),

  // Contract actions
  approveMilestone: (contractId, milestoneId, data) =>
    api
      .post(`/contracts/${contractId}/milestones/${milestoneId}/approve`, data)
      .then((res) => res.data),
  submitMilestone: (contractId, milestoneId, data) =>
    api
      .post(`/contracts/${contractId}/milestones/${milestoneId}/submit`, data)
      .then((res) => res.data),
  withdrawContract: (contractId, data) =>
    api.post(`/contracts/${contractId}/withdraw`, data).then((res) => res.data),
  refundContract: (contractId, data) =>
    api.post(`/contracts/${contractId}/refund`, data).then((res) => res.data),

  // Utils
  getTxStatus: (txHash) => api.get(`/tx/${txHash}`).then((res) => res.data),
  getScriptUtxos: (address) =>
    api.get(`/script/${address}/utxos`).then((res) => res.data),
};
