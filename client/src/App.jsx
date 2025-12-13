import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Jobs from "./pages/Jobs.jsx";
import PostJob from "./pages/PostJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import ContractDetail from "./pages/ContractDetail.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import FreelancerDashboard from "./pages/FreelancerDashboard.jsx";
import SubmitProposal from "./pages/SubmitProposal.jsx";
import ManageJob from "./pages/ManageJob.jsx";
import MyContracts from "./pages/MyContracts.jsx";
import MyProposals from "./pages/MyProposals.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
// import "./styles.css"; // Deprecated

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route
          path="/jobs/post"
          element={
            <ProtectedRoute requiredRole="client">
              <PostJob />
            </ProtectedRoute>
          }
        />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/jobs/:id/apply" element={<SubmitProposal />} />
        <Route
          path="/jobs/:id/manage"
          element={
            <ProtectedRoute requiredRole="client">
              <ManageJob />
            </ProtectedRoute>
          }
        />
        <Route path="/contracts" element={<MyContracts />} />
        <Route path="/contracts/:id" element={<ContractDetail />} />
        <Route path="/proposals" element={<MyProposals />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/client" element={<ClientDashboard />} />
        <Route path="/dashboard/freelancer" element={<FreelancerDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Layout>
  );
}

export default App;
