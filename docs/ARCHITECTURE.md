# Architecture — Cardano Freelance Escrow

## ASCII Diagram
```
┌────────────────────────────┐
│   User Browser (React UI)  │
│ - Wallet ext (Nami/Lace)   │
└─────────────┬──────────────┘
              │ CIP-30 / Mesh
              ▼
┌──────────────────────────────┐
│ Frontend (Vite + React)     │
│ - Wallet connect             │
│ - Build/sign tx (Mesh SDK)   │
│ - Call REST APIs             │
└──────────────┬───────────────┘
               │ HTTPS (REST/WebSocket)
               ▼
┌──────────────────────────────────────────────┐
│ Backend (Express + TS)                       │
│ - Auth (JWT + wallet verify)                 │
│ - Contracts/jobs/milestones APIs             │
│ - Tx verifier (Blockfrost)                   │
│ - Reconcile/poller for tx status             │
│ - Fee/config/env services                    │
└───────┬───────────────┬───────────────┬──────┘
        │               │               │
        ▼               ▼               ▼
┌──────────────┐  ┌───────────────┐  ┌────────────────┐
│ MongoDB      │  │ Blockfrost    │  │ Aiken Artifacts│
│ users/jobs   │  │ - submit tx   │  │ - .plutus/.cbor│
│ contracts    │  │ - fetch utxos │  │ - datum schema │
└──────────────┘  └───────────────┘  └────────────────┘
│ users/jobs   │  │ - submit tx   │  │ - fetch utxos │
│ contracts    │  │ - .plutus/.cbor│
└──────────────┘  └───────────────┘  │ - datum schema │
                                     └────────────────┘
                                     │ (used by FE/BE)
                                     ▼
                           Cardano Preprod Network
```

## Components
- **Client**: React app using Mesh SDK for wallet connect, UTxO read, and tx building (payToContract, redeemFromScript). Uses REST for metadata, listings, and tx verification.
- **Backend**: Express/TS with services for auth, contracts, milestones, payments, disputes, and chain verification. Submits or monitors txs via Blockfrost. Enforces idempotency by txHash.
- Contracts: Aiken validator implementing escrow rules with inline datum and redeemers (Deposit, Approve/Release, Withdraw, Refund, Arbitrate optional). Build outputs consumed by FE/BE.
- DB: MongoDB for users, jobs/projects, contracts (with milestones), payments, disputes, nonces, and activity feed.

## Data Flow (happy path)
1. Client creates job & contract via backend; receives contract address + datum.
2. Client funds escrow (Mesh payToContract) using returned datum/address.
3. Backend verifies on-chain (Blockfrost) and marks deposit confirmed.
4. Freelancer submits deliverable; client approves (redeemer Approve).
5. Tx spends script UTxO to freelancer; platform fee routed; backend records payout.
6. Disputes/refunds use dedicated redeemers and role signatures (client/admin/arbitrator).

## Security Notes
- No private keys server-side; only public identifiers stored.
- CIP-30 signed message to link wallets; JWT for session.
- Rate limiting, CORS allowlist, helmet, logging.
- Idempotent writes keyed by txHash; unique indexes on txHash and wallet/email.

## Observability
- Health endpoint (db, blockfrost reachability, queue depth).
- Structured request/tx logs.
- Reconcile job comparing chain UTxOs to DB state; reports mismatches.

## Deployment
- **Client**: static hosting (Vercel/Netlify).
- **Backend**: Render/Railway; env-injected secrets.
- DB: Mongo Atlas.
- Chain: Cardano preprod via Blockfrost.
