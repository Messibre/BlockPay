<p align="center">
  <img src="client/public/logo.png" alt="BlockPay Logo" width="120" height="120" />
</p>

<h1 align="center">BlockPay</h1>

<p align="center">
  <strong>Decentralized Freelance Escrow Platform on Cardano</strong>
</p>

<p align="center">
  Secure, transparent, and trustless freelance payments powered by smart contracts.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#license">License</a>
</p>

---

## Overview

BlockPay is a decentralized freelance marketplace that eliminates the need for trusted intermediaries in freelance payments. By leveraging Cardano's smart contract capabilities through Aiken, BlockPay ensures that funds are held securely in on-chain escrow until work is delivered and approved.

### The Problem

Traditional freelance platforms charge high fees (15-20%), hold funds for extended periods, and act as centralized points of failure. Freelancers face delayed payments, while clients have limited recourse for disputes.

### The Solution

BlockPay uses blockchain technology to:
- **Eliminate middlemen** — Funds move directly between client and freelancer wallets
- **Reduce fees** — Smart contracts automate escrow at minimal cost
- **Ensure transparency** — All transactions are verifiable on-chain
- **Enable instant payments** — Released funds arrive in seconds, not days
- **Provide dispute resolution** — On-chain arbitration with verifiable outcomes

---

## Features

### For Clients
- **Post Jobs** — Create detailed job listings with budgets in ADA
- **Milestone-Based Payments** — Break projects into fundable milestones
- **Secure Escrow** — Funds are locked in smart contracts until work is approved
- **Transparent History** — View all contract activity on-chain

### For Freelancers
- **Browse Opportunities** — Filter jobs by skills, budget, and experience level
- **Submit Proposals** — Apply with custom terms and timeline
- **Guaranteed Payment** — Approved milestones release funds automatically
- **Instant Withdrawals** — No waiting periods for completed work

### Platform Features
- **CIP-30 Wallet Integration** — Connect Nami, Eternl, Lace, and more
- **Real-Time Notifications** — Stay updated on contract activity
- **Dispute Resolution** — On-chain arbitration for conflict resolution
- **Dark/Light Theme** — Comfortable viewing in any environment
- **Mobile Responsive** — Full functionality on all devices

---

## Architecture

BlockPay follows a three-tier architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                React SPA (Vite)                          │   │
│  │  • Pages: Home, Jobs, Dashboard, Contracts, Auth         │   │
│  │  • Contexts: Auth, Wallet, Toast                         │   │
│  │  • Mesh SDK: CIP-30 wallet connection & tx building      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER LAYER                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Express.js REST API                         │   │
│  │  • Controllers: Auth, Jobs, Contracts, Payments          │   │
│  │  • Middleware: JWT Auth, Rate Limiting, Validation       │   │
│  │  • Services: Blockfrost verification, Notifications      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     MongoDB                              │   │
│  │  • Collections: Users, Jobs, Contracts, Payments         │   │
│  │  • Off-chain state & metadata storage                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN LAYER                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Cardano Preprod Network                       │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         Aiken Escrow Validator                  │    │   │
│  │  │  • Deposit: Lock ADA with contract datum        │    │   │
│  │  │  • Release: Client approves milestone           │    │   │
│  │  │  • Withdraw: Freelancer claims payment          │    │   │
│  │  │  • Refund: Return funds if conditions unmet     │    │   │
│  │  │  • Arbitrate: Third-party dispute resolution    │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + Vite | Fast, modern SPA with HMR |
| Styling | CSS Modules | Scoped, maintainable styles |
| Wallet | Mesh SDK | CIP-30 wallet integration |
| Backend | Express.js (ESM) | RESTful API server |
| Database | MongoDB + Mongoose | Off-chain data persistence |
| Blockchain | Cardano Preprod | Secure value transfer |
| Smart Contracts | Aiken | Type-safe Plutus validators |
| Chain API | Blockfrost | Transaction verification |

---

## Project Structure

```
blockpay/
├── client/                    # React frontend
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React context providers
│   │   ├── pages/             # Route components
│   │   ├── services/          # API client
│   │   └── App.jsx            # Root component
│   └── package.json
│
├── backend/                   # Express API
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/        # Auth, validation, etc.
│   │   ├── models/            # Mongoose schemas
│   │   ├── routes/            # API route definitions
│   │   └── app.js             # Express app setup
│   └── package.json
│
├── contracts/                 # Aiken smart contracts
│   ├── validators/
│   │   └── escrow.ak          # Main escrow validator
│   ├── lib/                   # Shared contract logic
│   └── aiken.toml             # Aiken project config
│
└── docs/                      # Documentation
    ├── API.md                 # API reference
    ├── SETUP.md               # Installation guide
    └── CONTRACTS.md           # Smart contract docs
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** (local instance or Atlas)
- **Aiken** — [Install Aiken](https://aiken-lang.org/installation-instructions)
- **Cardano Wallet** — Nami, Eternl, or Lace browser extension

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/blockpay.git
   cd blockpay
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment variables**

   Copy the example files and fill in your values:
   ```bash
   cp backend/.env.example backend/.env
   cp client/.env.example client/.env
   ```

   Required backend variables:
   ```env
   MONGO_URI=mongodb://localhost:27017/blockpay
   JWT_SECRET=your-secure-secret-key
   BLOCKFROST_KEY=preprodYourBlockfrostApiKey
   NETWORK=preprod
   ESCROW_SCRIPT_ADDRESS=addr_test1...
   ```

   Required frontend variables:
   ```env
   VITE_BACKEND_URL=http://localhost:5000
   ```

4. **Build the smart contract**
   ```bash
   cd contracts
   aiken build
   aiken address
   ```
   Copy the generated address to `ESCROW_SCRIPT_ADDRESS` in your backend `.env`.

5. **Start the development servers**

   In one terminal:
   ```bash
   cd backend && npm run dev
   ```

   In another terminal:
   ```bash
   cd client && npm run dev
   ```

6. **Open the application**

   Navigate to `http://localhost:5173` in your browser.

---

## Smart Contract

The escrow validator is written in Aiken and supports the following redeemers:

### Redeemers

| Redeemer | Actor | Description |
|----------|-------|-------------|
| `Deposit` | Client | Lock ADA into the escrow address |
| `Release(milestone_id)` | Client | Approve a milestone for freelancer payout |
| `Withdraw(milestone_id)` | Freelancer | Claim released milestone funds |
| `Refund` | Client | Reclaim funds if no milestones were paid |
| `Arbitrate(decision)` | Arbitrator | Resolve disputes with binding decision |

### Datum Structure

```aiken
type EscrowDatum {
  client: VerificationKeyHash,
  freelancer: VerificationKeyHash,
  arbitrator: Option<VerificationKeyHash>,
  milestones: List<Milestone>,
  platform_fee_bps: Int,
  created_at: POSIXTime,
}

type Milestone {
  id: Int,
  amount: Int,
  status: MilestoneStatus,
}
```

### Security Model

- **No custodial keys** — All signing happens client-side in user wallets
- **Validator-enforced rules** — Smart contract logic cannot be bypassed
- **Collateral protection** — 5 ADA collateral required for Plutus spends
- **Timelock safety** — Refunds only available after contract deadline

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Get current user |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs (with filters) |
| POST | `/api/jobs` | Create job (client only) |
| GET | `/api/jobs/:id` | Get job details |
| PUT | `/api/jobs/:id` | Update job |
| DELETE | `/api/jobs/:id` | Delete job |

### Contracts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contracts` | Create contract from proposal |
| GET | `/api/contracts/:id` | Get contract details |
| POST | `/api/contracts/:id/fund` | Record deposit transaction |
| POST | `/api/contracts/:id/release` | Release milestone |
| POST | `/api/contracts/:id/dispute` | Open dispute |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List user's payments |
| POST | `/api/payments/verify` | Verify on-chain transaction |

See [docs/API.md](docs/API.md) for complete API documentation.

---

## Deployment

### Vercel (Recommended)

BlockPay is optimized for Vercel deployment. Create two separate projects:

#### Frontend Deployment

1. Import the repository to Vercel
2. Set root directory to `client`
3. Framework preset: Vite
4. Environment variables:
   - `VITE_BACKEND_URL` — Your backend URL

#### Backend Deployment

1. Import the repository to Vercel
2. Set root directory to `backend`
3. Environment variables:
   - `MONGO_URI` — MongoDB connection string
   - `JWT_SECRET` — Secure random string
   - `BLOCKFROST_KEY` — Blockfrost API key
   - `NETWORK` — `preprod` or `mainnet`
   - `ESCROW_SCRIPT_ADDRESS` — Deployed validator address

### Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d
```

---

## Security Considerations

- **Wallet Security** — Private keys never leave the user's wallet extension
- **JWT Authentication** — Secure, httpOnly cookies with short expiration
- **Input Validation** — All inputs sanitized with express-validator
- **Rate Limiting** — API endpoints protected against abuse
- **CORS** — Strict origin policy in production
- **Helmet** — Security headers enabled

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Roadmap

- [x] Core escrow functionality
- [x] CIP-30 wallet integration
- [x] Job marketplace
- [x] Milestone-based payments
- [ ] NFT receipts for completed contracts
- [ ] Multi-signature arbitration
- [ ] Reputation system
- [ ] Mainnet deployment

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 BlockPay

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Acknowledgments

- [Cardano Foundation](https://cardanofoundation.org/) — For the Cardano blockchain
- [Aiken](https://aiken-lang.org/) — For the smart contract language
- [Mesh](https://meshjs.dev/) — For the wallet integration SDK
- [Blockfrost](https://blockfrost.io/) — For the Cardano API

---

<p align="center">
  Built with ❤️ for the Cardano ecosystem
</p>
