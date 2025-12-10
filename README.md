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


