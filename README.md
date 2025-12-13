# Cardano Freelance Escrow

Secure, transparent freelance payments on Cardano (preprod) with an escrow smart contract (Aiken), Mesh-powered React frontend, and Express/JavaScript backend. Designed to run on low-spec machines (no Tailwind, minimal deps).

## Stack

- Frontend: Vite + React + Mesh SDK (CIP-30), CSS modules.
- Backend: Node + Express + JavaScript (ESM), MongoDB, Blockfrost.
- Smart contracts: Aiken validator (escrow) with inline datum; optional minting policy.

## Quick Start

### Prerequisites

- **Aiken** (required): `iwr https://get.aiken-lang.org | iex` (Windows) or `curl -sSf https://get.aiken-lang.org | sh` (macOS/Linux)
- **Node.js** >= 18.0.0
- **MongoDB** (local or Atlas)
- **Cardano CLI** (optional - only for advanced debugging)

See [docs/SETUP.md](docs/SETUP.md) for detailed installation instructions.

### Setup Steps

1. Install dependencies: `npm run install:all`
2. Copy `ENV.example` to `backend/.env` and `frontend/.env`, fill in values
3. Get Blockfrost API key from https://blockfrost.io/
4. Build contract: `cd contracts && aiken build && aiken address` (copy address to backend)
5. Start backend: `cd backend && npm run dev`
6. Start frontend: `cd frontend && npm run dev`

## Repos & Folders

- `frontend/` SPA (wallet connect, deposits, approvals, disputes).
- `backend/` API + chain verifier + reconcile jobs.
- `contracts/` Aiken sources and build artifacts.
- `docs/` architecture and API references.
- `scripts/` helper scripts (seeding, contract build).

## Demo Flow

1. Client posts job and creates contract with milestones.
2. Client funds escrow (Mesh payToContract) using returned datum/address.
3. Freelancer submits deliverables; client approves milestone (redeemer Approve).
4. Payout sent to freelancer; platform fee routed to fee address.
5. Dispute/refund paths via dedicated redeemers and admin arbitration.

## Notes

- Target network: Cardano preprod via Blockfrost.
- Wallets: Nami / Eternl / Lace (CIP-30).
- Collateral: ensure a 5 ADA collateral UTxO is available for Plutus spends.
- Security: no private keys ever stored; signatures stay client-side.

## Deploying with Vercel

- Recommended approach: create two Vercel projects — one using the `client/` folder (frontend) and one using the `backend/` folder (API). Each project should be configured to use the correct root.
- Alternatively, connect the whole monorepo and set up two projects, each with a `Root Directory` to `client` and `backend` respectively within the Vercel dashboard.

### Frontend (client)

- Root: `client`
- Framework: `Other` (Vite) or auto-detected by Vercel
- Build Command: `npm run build`
- Output directory: `dist`
- Environment variables: set `VITE_BACKEND_URL` to your backend deployment URL (example: `https://your-backend.vercel.app/api/v1`).

### Backend (API)

- Root: `backend`
- This repository provides a serverless wrapper at `backend/api/catchall.js` which forwards all `/api/*` requests to the Express `app` (and connects to MongoDB).
- Build: Vercel will automatically detect `api/` functions in the `backend` project and use `@vercel/node`.
- Environment variables: `MONGO_URI`, `JWT_SECRET`, `BLOCKFROST_KEY`, `NETWORK`, `PLATFORM_FEE_BPS`, `PLATFORM_FEE_ADDRESS`, `ARBITRATOR_PKH`, `CLIENT_ORIGINS`, `ESCROW_SCRIPT_ADDRESS`.

### Tips

- Set environment variables in the Vercel dashboard for each project (Frontend: `VITE_*` variables; Backend: `MONGO_URI` etc.).
- For local dev use, copy `ENV.example` to `backend/.env` and `client/.env` and fill values.
- If you want to deploy the entire monorepo as a single Vercel project, use a custom `vercel.json`, but we recommend the two-project approach for clarity.

If you prefer a single Vercel project, this repo includes a root `vercel.json` that:

- Builds and serves the static frontend from `client/`.
- Routes `/api/*` to the serverless wrapper at `backend/api/catchall.js`.
