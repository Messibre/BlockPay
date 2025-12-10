# Critical Fixes Needed

## 1. Fix Mesh SDK Wallet Connection

**Problem:** Wallet connection won't work without proper initialization.

**Fix:** Update `frontend/src/main.jsx`:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "react-query";
import { MeshProvider } from "@meshsdk/react";
import App from "./App.jsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MeshProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MeshProvider>
  </React.StrictMode>
);
```

**Also update `frontend/src/components/Layout.jsx`:**

```jsx
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@meshsdk/react";
import styles from "./Layout.module.css";

export default function Layout({ children }) {
  const { connected, connect, disconnect, name } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      // Specify wallet name (Nami, Eternl, or Lace)
      await connect("nami"); // or "eternl" or "lace"
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Please install a Cardano wallet extension (Nami, Eternl, or Lace)");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/");
  };

  return (
    // ... rest of component
  );
}
```

## 2. Add Missing Milestone Controller

**Create:** `backend/src/controllers/milestoneController.js`

```javascript
import Contract from "../models/Contract.js";
import { verifyPayout } from "../services/chainVerifier.js";
import Payment from "../models/Payment.js";

export const submitDeliverable = async (req, res, next) => {
  try {
    const { id: contractId, mid: milestoneId } = req.params;
    const { files, notes } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    if (contract.freelancerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only freelancer can submit" });
    }

    const milestone = contract.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    milestone.status = "submitted";
    milestone.files = files || [];
    milestone.notes = notes || "";
    milestone.submittedAt = new Date();

    await contract.save();

    res.json({
      message: "Deliverable submitted",
      milestone,
    });
  } catch (error) {
    next(error);
  }
};

export const approveMilestone = async (req, res, next) => {
  try {
    const { id: contractId, mid: milestoneId } = req.params;

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    if (contract.clientId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only client can approve" });
    }

    const milestone = contract.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    if (milestone.status !== "submitted") {
      return res.status(400).json({ message: "Milestone not submitted" });
    }

    milestone.status = "approved";
    milestone.approvedAt = new Date();

    // Update datum milestone paid status
    const datumMilestone = contract.datum.milestones.find(
      (m) => m.id === milestoneId
    );
    if (datumMilestone) {
      datumMilestone.paid = true;
    }

    await contract.save();

    res.json({
      message: "Milestone approved",
      milestone,
      // Frontend will build and submit Release transaction
      action: "release",
      contractAddress: contract.contractAddress,
      milestoneId,
      amount: milestone.amount,
    });
  } catch (error) {
    next(error);
  }
};

export const recordWithdraw = async (req, res, next) => {
  try {
    const { id: contractId, mid: milestoneId } = req.params;
    const { txHash } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const milestone = contract.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    // Verify payout on-chain
    const verification = await verifyPayout(
      txHash,
      contract.datum.freelancer,
      milestone.amount
    );

    if (!verification.valid) {
      return res.status(422).json({
        message: "Transaction verification failed",
        error: verification.error,
      });
    }

    // Create payment record
    const payment = new Payment({
      contractId,
      milestoneId,
      paymentType: "payout",
      amountADA: verification.amount,
      txHash,
      status: verification.status || "CONFIRMED",
      blockTime: verification.blockTime,
      blockHeight: verification.blockHeight,
      explorerLink: verification.explorerLink,
      toAddress: contract.datum.freelancer,
    });

    await payment.save();

    // Update milestone
    milestone.status = "paid";
    milestone.paidAt = new Date();
    await contract.save();

    res.json({
      status: payment.status,
      txHash,
      explorerLink: payment.explorerLink,
    });
  } catch (error) {
    next(error);
  }
};
```

**Add routes:** `backend/src/routes/milestones.js`

```javascript
import express from "express";
import * as milestoneController from "../controllers/milestoneController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/contracts/:id/milestones/:mid/submit",
  authenticate,
  milestoneController.submitDeliverable
);
router.post(
  "/contracts/:id/milestones/:mid/approve",
  authenticate,
  milestoneController.approveMilestone
);
router.post(
  "/contracts/:id/milestones/:mid/withdraw",
  authenticate,
  milestoneController.recordWithdraw
);

export default router;
```

**Update:** `backend/src/routes/index.js`

```javascript
import milestoneRoutes from "./milestones.js";
// ... other imports

router.use("/", milestoneRoutes);
```

## 3. Fix Contract Address

**After building contract:**

```bash
cd contracts
aiken build
aiken address
```

**Update:** `backend/src/controllers/contractController.js`

```javascript
// Replace generateContractAddress() with:
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "addr_test1w...";
// Add CONTRACT_ADDRESS to .env file
```

## 4. Fix User Address Fetching

**Update:** `backend/src/controllers/contractController.js` line 29-32:

```javascript
// Get client and freelancer addresses
const client = await User.findById(req.userId);
const freelancer = await User.findById(freelancerId);

if (!client || !freelancer) {
  return res.status(404).json({ message: "User not found" });
}

const clientAddress = client.walletAddress;
const freelancerAddress = freelancer.walletAddress;
```

**Add import:**

```javascript
import User from "../models/User.js";
```

## 5. Create Environment Files

```bash
# Backend
cp ENV.example backend/.env
# Edit backend/.env with your values

# Frontend
cp ENV.example frontend/.env
# Edit frontend/.env with your values
```
