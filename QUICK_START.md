# Quick Start Guide

## What You Need (Minimum)

1. **Aiken** - Builds smart contracts
2. **Node.js** - Runs backend/frontend
3. **MongoDB** - Database (or use Atlas cloud)
4. **Blockfrost API Key** - Chain queries (free tier available)

## Installation (5 minutes)

### 1. Install Aiken

**Windows (PowerShell):**
```powershell
iwr https://get.aiken-lang.org | iex
```

**macOS/Linux:**
```bash
curl -sSf https://get.aiken-lang.org | sh
```

**Verify:**
```bash
aiken --version
```

### 2. Install Node.js

Download from: https://nodejs.org/ (LTS version)

**Verify:**
```bash
node --version  # Should be >= 18
```

### 3. Install MongoDB

**Option A: Cloud (Easiest)**
- Sign up at: https://www.mongodb.com/cloud/atlas
- Create free cluster
- Get connection string

**Option B: Local**
- Download from: https://www.mongodb.com/try/download/community

### 4. Get Blockfrost API Key

1. Go to: https://blockfrost.io/
2. Sign up (free)
3. Create project (select "Preprod")
4. Copy project ID

## Setup Project (10 minutes)

### Step 1: Install Dependencies
```bash
npm run install:all
```

### Step 2: Configure Environment

**Backend:**
```bash
cp ENV.example backend/.env
# Edit backend/.env with your values
```

**Frontend:**
```bash
cp ENV.example frontend/.env
# Edit frontend/.env with your values
```

### Step 3: Build Contract
```bash
cd contracts
aiken build
aiken test
aiken address  # Copy this address!
```

### Step 4: Update Backend

Edit `backend/src/controllers/contractController.js`:
```javascript
// Replace line 6-10 with:
const CONTRACT_ADDRESS = "addr_test1w..."; // From aiken address
```

### Step 5: Start Servers

**Terminal 1:**
```bash
cd backend
npm run dev
```

**Terminal 2:**
```bash
cd frontend
npm run dev
```

## Test It

1. Open: http://localhost:5173
2. Install wallet extension (Nami/Eternl/Lace)
3. Switch wallet to "Preprod" network
4. Click "Connect Wallet"

## Cardano CLI? (Optional)

**You DON'T need it** for this project! But if you want it:

- **Windows:** Download from https://github.com/IntersectMBO/cardano-node/releases
- **macOS:** `brew install cardano-node`
- **Linux:** Build from source or use pre-built binary

See [docs/CARDANO_CLI.md](docs/CARDANO_CLI.md) for details.

## Troubleshooting

**Aiken not found?**
- Restart terminal
- Check PATH: `echo $PATH` (Linux/Mac) or `$env:PATH` (Windows)

**Port already in use?**
- Change PORT in `backend/.env`

**MongoDB connection failed?**
- Check MONGO_URI in `backend/.env`
- For Atlas: Whitelist your IP

**Blockfrost 401 error?**
- Check BLOCKFROST_KEY in `.env` files

## Next Steps

- Read [docs/SETUP.md](docs/SETUP.md) for detailed guide
- Read [docs/CARDANO_CLI.md](docs/CARDANO_CLI.md) if you want CLI tools
- Check [contracts/README.md](contracts/README.md) for contract details

