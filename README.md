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

- `client/` SPA (wallet connect, deposits, approvals, disputes).
- `backend/` API + chain verifier + reconcile jobs.
- `contracts/` Aiken sources and build artifacts.
- `docs/` architecture and API references.
- `scripts/` helper scripts (seeding, contract build).

## Demo Flow

1. **Client** posts a job and creates a contract with milestones.
2. **Client** funds the escrow (Mesh payToContract) using the returned datum/address.
3. **Freelancer** submits their work via the dashboard.
4. **Client** reviews and approves the milestone (triggering the Release redeemer).
5. **Smart Contract** automatically sends the payout to the freelancer and routes the platform fee.
6. Dispute/refund paths available via dedicated redeemers and admin arbitration.

## Notes

- Target network: Cardano preprod via Blockfrost.
- Wallets: Nami / Eternl / Lace (CIP-30).
- Collateral: ensure a 5 ADA collateral UTxO is available for Plutus spends.
- Security: no private keys ever stored; signatures stay client-side.

## Deployment

### Vercel (Recommended)

This repository is optimized for Vercel. We recommend creating two separate projects:

1.  **Frontend (`client` folder)**
    -   Root Directory: `client`
    -   Framework: Vite
    -   Build Command: `npm run build`
    -   Output: `dist`
    -   Env Vars: `VITE_BACKEND_URL` (point to your backend deployment).

2.  **Backend (`backend` folder)**
    -   Root Directory: `backend`
    -   Env Vars: `MONGO_URI`, `JWT_SECRET`, `BLOCKFROST_KEY`, `NETWORK` (preprod), `ESCROW_SCRIPT_ADDRESS`.
    -   *Note: Includes a serverless wrapper at `api/catchall.js`.*
