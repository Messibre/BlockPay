# Frontend Ready for Smart Contract Integration

## ✅ Completed Features

### Core Infrastructure

- ✅ Authentication system with JWT tokens
- ✅ Global state management (AuthContext, ToastContext)
- ✅ Protected routes with role-based access
- ✅ Reusable UI components library
- ✅ Error handling and toast notifications
- ✅ Loading states and spinners

### Pages Implemented

1. **Home** - Landing page with role-based actions
2. **Login/Register** - Full authentication flow
3. **Jobs Browse** - Advanced filtering, search, pagination
4. **Post Job** - Complete job creation form
5. **Job Detail** - Job viewing with apply button
6. **Client Dashboard** - Summary cards, quick actions, notifications
7. **Freelancer Dashboard** - Summary cards, earnings, proposals
8. **Contract Detail** - Basic contract viewing (ready for enhancement)

### API Integration

All API methods are set up in `client/src/services/api.js`:

- Auth: register, login, verifyWallet, getMe
- Jobs: getJobs, getJob, createJob
- Contracts: createContract, getContract, recordDeposit, getDeposits
- Contract Actions: approveMilestone, submitMilestone, withdrawContract, refundContract
- Proposals: submitProposal, getProposals (ready for backend)
- Utils: getTxStatus, getScriptUtxos

## 🔗 Smart Contract Integration Points

### 1. Contract Creation Flow

**Location**: `client/src/pages/PostJob.jsx` → Job Detail → Create Contract

**What you need to implement:**

- After job is posted and proposal accepted, create contract
- Call `api.createContract()` which should return:
  ```javascript
  {
    contractId,
      contractAddress, // Script address for escrow
      contractDatum, // Initial datum for the contract
      depositInstructions; // Instructions for client to deposit
  }
  ```

### 2. Deposit Funds Flow

**Location**: Contract Detail page (needs enhancement)

**What you need to implement:**

- Client deposits ADA to contract address
- Use Mesh SDK to build transaction:

  ```javascript
  import { useWallet } from "@meshsdk/react";
  const { wallet } = useWallet();

  // Build transaction to send ADA to contractAddress
  // Include inline datum (contractDatum)
  // Sign and submit transaction
  // Record txHash with api.recordDeposit(contractId, txHash, amount)
  ```

### 3. Milestone Approval Flow

**Location**: Contract Detail page

**What you need to implement:**

- Freelancer submits milestone work
- Client approves milestone
- Build transaction to spend script UTxO:
  ```javascript
  // Use redeemer: Approve(milestoneId)
  // Pay freelancer address
  // Deduct platform fee if configured
  // Sign with client's wallet
  // Submit transaction
  // Call api.approveMilestone(contractId, milestoneId, { txHash })
  ```

### 4. Transaction Status Monitoring

**Location**: Contract Detail, Payment pages

**What you need to implement:**

- Poll `api.getTxStatus(txHash)` to check confirmation
- Display status: PENDING → CONFIRMED → FAILED
- Update UI when transaction confirms

### 5. Script UTxO Querying

**Location**: Contract Detail page

**What you need to implement:**

- Call `api.getScriptUtxos(contractAddress)` to see:
  - Current balance locked in contract
  - Datum state
  - Transaction history

## 📋 Key Files for Smart Contract Integration

### Frontend Files to Enhance:

1. **`client/src/pages/ContractDetail.jsx`**

   - Add deposit button for clients
   - Add milestone approval UI
   - Add transaction status display
   - Add script UTxO balance display

2. **`client/src/services/api.js`**

   - Already has all contract endpoints defined
   - Just need backend to implement them

3. **`client/src/components/`** (Reusable components ready)
   - Button, Modal, Card, Input, Select
   - LoadingSpinner, Toast (for status updates)

### Smart Contract Integration Helper

Create a new file: `client/src/utils/contractHelpers.js`

```javascript
import { useWallet } from "@meshsdk/react";

export async function depositToContract(
  wallet,
  contractAddress,
  amount,
  datum
) {
  // Build transaction to deposit ADA to contract
  // Return unsigned transaction
}

export async function approveMilestone(
  wallet,
  contractAddress,
  milestoneId,
  redeemer
) {
  // Build transaction to spend script UTxO
  // Return unsigned transaction
}
```

## 🎯 Testing Checklist Before Smart Contract Integration

- [x] Authentication flow works (login/register/logout)
- [x] Job posting works
- [x] Job browsing and filtering works
- [x] Dashboards display correctly
- [x] Protected routes redirect properly
- [x] Toast notifications work
- [x] Loading states display correctly
- [ ] API endpoints return expected data structure
- [ ] Error handling works for API failures

## 🔄 Data Flow for Smart Contract Operations

### Contract Creation:

1. Client posts job → `POST /jobs`
2. Freelancer applies → `POST /jobs/:id/proposals`
3. Client accepts proposal → `POST /contracts` (creates contract + returns contractAddress)
4. Client deposits funds → Build tx → `POST /contracts/:id/deposit` (records txHash)

### Milestone Workflow:

1. Freelancer submits work → `POST /contracts/:id/milestones/:mid/submit`
2. Client approves → Build spend tx → `POST /contracts/:id/milestones/:mid/approve`
3. Backend verifies on-chain → Updates contract state

## 📝 Notes

- All API calls include JWT token automatically via axios interceptor
- User data uses `fullName` from backend, mapped to `displayName` in frontend
- Budget amounts are in lovelace (1 ADA = 1,000,000 lovelace)
- All dates should be handled consistently (ISO format from API)

## 🚀 Next Steps

1. **Backend**: Implement contract creation endpoint that returns contractAddress
2. **Frontend**: Enhance ContractDetail page with deposit/approval UI
3. **Smart Contract**: Build Plutus script for escrow
4. **Integration**: Connect Mesh SDK to build and sign transactions
5. **Testing**: Test full flow from job posting to payment release

---

**Status**: Frontend is ready for smart contract integration! 🎉
