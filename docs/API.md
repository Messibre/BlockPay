# API Reference — Cardano Freelance Escrow
Base URL: `/api/v1`

Auth: JWT in `Authorization: Bearer <token>`. Wallet verify uses signed nonce. All bodies JSON.

## Auth & User
- `POST /auth/register` — {email, password, displayName} → {token, user}
- `POST /auth/login` — {email, password} → {token, user}
- `POST /auth/wallet/verify` — {address, signature, message} → {token, user}
  - Server verifies signature ↔ address; creates/links user; stores pubkeyhash.
- `GET /users/me` — auth — returns profile.
- `PATCH /users/me` — auth — update displayName/email/preferredLanguage.

## Jobs
- `POST /jobs` — client auth — {title, description, budgetMin, budgetMax, currency, tags, visibility} → {jobId}
- `GET /jobs` — list with filters (?tag ?minBudget ?maxBudget ?page ?limit)

## Contracts
- `POST /contracts` — client auth
  - Body: {jobId, freelancerId, totalAmount, milestones[{id,title,amount,dueDate}], feePayer}
  - Response: {contractId, contractAddress, contractDatum, depositInstructions}
- `GET /contracts/:id` — auth — contract detail + milestones + deposits/payouts/status.
- `PATCH /contracts/:id` — auth — limited updates (description, due dates) when not funded.

## Funding / Deposits
- `POST /contracts/:id/deposit` — client auth
  - Body: {txHash, amount}
  - Server verifies on-chain: tx pays contractAddress with correct inline datum and amount. Idempotent by txHash.
  - Response: {status:"PENDING"}
- `GET /contracts/:id/deposits` — list with status, txHash, blockTime.

## Milestones & Delivery
- `POST /contracts/:id/milestones/:mid/submit` — freelancer auth
  - Body: {files:[url], notes}
  - Marks milestone SUBMITTED, notifies client.
- `POST /contracts/:id/milestones/:mid/approve` — client auth
  - Body optional: {txSignedByClient}
  - Approve flow: spend script UTxO with redeemer Approve, pay freelancer, deduct platform fee if configured. Response: {status, txHash?}

## Payouts / Refunds / Arbitration
- `POST /contracts/:id/withdraw` — freelancer auth
  - Body: {txHash} when wallet submits; server verifies payout to freelancer.
- `POST /contracts/:id/refund` — client/admin auth
  - Body: {reason, txHash?}; allowed if not delivered before deadline or cancellation rules met.
- `POST /contracts/:id/disputes` — either party
  - Body: {milestoneId, reason, evidenceUrls}
  - Locks auto-payment; status NOTIFIED.
- `POST /contracts/:id/arbitrate` — admin/arbitrator auth
  - Body: {decision:"refund|pay_partial|pay_full", distribution[{userId, amount}], evidence}
  - Constructs Arbitrate redeemer tx; requires arbitrator signature.

## Monitoring / Utilities
- `GET /tx/:txHash` — tx status (PENDING/CONFIRMED/FAILED), blockTime, explorerLink.
- `GET /script/:address/utxos` — list parsed UTxOs at script address (amounts, datum, txHash).
- `GET /health` — db, blockfrost reachability, queue length.

## Admin
- `GET /admin/contracts` — filter by status/disputes.
- `GET /admin/disputes` — review queue.

## Errors
- 400 bad request (validation), 401 unauthorized, 403 forbidden, 404 not found,
  409 conflict (duplicate txHash), 422 tx verification failed, 500 server error.

## Acceptance & Verification Notes
- All tx-linked endpoints verify on-chain inclusion, recipient amounts, script address, and inline datum match contract state.
- Idempotent writes keyed by txHash; duplicates rejected with 409.
- Platform fee deducted on payouts when configured (fee bps, fee address).
- Collateral guidance returned when wallet lacks Plutus collateral UTxO.


