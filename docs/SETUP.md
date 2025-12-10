# Setup Guide - Cardano Freelance Escrow

Complete setup instructions for development and deployment.

## Required Tools

### 1. Aiken (Required)
**What it does:** Builds and compiles smart contracts, derives validator addresses.

**Installation:**

**Windows (PowerShell):**
```powershell
# Install via Aiken installer
iwr https://get.aiken-lang.org | iex

# Or via Scoop (if you have it)
scoop install aiken
```

**macOS/Linux:**
```bash
# Install via Aiken installer
curl -sSf https://get.aiken-lang.org | sh

# Or via Homebrew (macOS)
brew install aikenlang/aiken/aiken
```

**Verify installation:**
```bash
aiken --version
```

**Update Aiken:**
```bash
aiken up
```

### 2. Node.js (Required)
**What it does:** Runs backend and frontend.

**Installation:**
- Download from: https://nodejs.org/ (LTS version recommended)
- Or use nvm: https://github.com/nvm-sh/nvm

**Verify:**
```bash
node --version  # Should be >= 18.0.0
npm --version
```

### 3. MongoDB (Required)
**What it does:** Database for off-chain data.

**Options:**
- **Local:** https://www.mongodb.com/try/download/community
- **Cloud (Recommended):** MongoDB Atlas (free tier): https://www.mongodb.com/cloud/atlas

**For local MongoDB:**
```bash
# Windows: Download installer from MongoDB website
# macOS: brew install mongodb-community
# Linux: sudo apt-get install mongodb
```

### 4. Cardano CLI (Optional but Recommended)
**What it does:** Advanced operations, manual transaction building, address derivation, querying chain directly.

**When you need it:**
- Manual transaction inspection
- Advanced debugging
- Direct chain queries (though Blockfrost handles this)
- Building transactions without Mesh SDK (not needed for this project)

**Installation:**

**Option 1: Pre-built Binaries (Easiest)**
1. Download from: https://github.com/IntersectMBO/cardano-node/releases
2. Look for latest release with `cardano-cli` binaries
3. Extract and add to PATH

**Option 2: Build from Source (Advanced)**
```bash
# Requires: GHC, Cabal, libsodium
git clone https://github.com/IntersectMBO/cardano-node.git
cd cardano-node
git checkout <latest-tag>
cabal build cardano-cli
```

**Option 3: Docker (Alternative)**
```bash
docker pull inputoutput/cardano-node:latest
docker run -it inputoutput/cardano-node cardano-cli --version
```

**Verify installation:**
```bash
cardano-cli --version
```

**Note:** For this project, Cardano CLI is **optional** because:
- ✅ Aiken can derive validator addresses
- ✅ Mesh SDK builds transactions
- ✅ Blockfrost queries the chain

You only need it for advanced debugging or manual operations.

## Project Setup

### Step 1: Install Aiken
```bash
# Windows PowerShell
iwr https://get.aiken-lang.org | iex

# macOS/Linux
curl -sSf https://get.aiken-lang.org | sh
```

### Step 2: Install Dependencies
```bash
# From project root
npm run install:all

# Or manually:
cd backend && npm install
cd ../frontend && npm install
```

### Step 3: Set Up Environment Variables

**Backend `.env`:**
```bash
cp ENV.example backend/.env
```

Edit `backend/.env`:
```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/cardano-escrow
# Or for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/cardano-escrow

JWT_SECRET=your_secret_key_here_change_me
BLOCKFROST_KEY=your_blockfrost_project_id
NETWORK=preprod
PLATFORM_FEE_BPS=100
PLATFORM_FEE_ADDRESS=addr_test1...
ARBITRATOR_PKH=your_arbitrator_pubkeyhash
CLIENT_ORIGINS=http://localhost:5173
```

**Frontend `.env`:**
```bash
cp ENV.example frontend/.env
```

Edit `frontend/.env`:
```env
VITE_BLOCKFROST_KEY=your_blockfrost_project_id
VITE_NETWORK=preprod
VITE_BACKEND_URL=http://localhost:4000/api/v1
VITE_PLATFORM_FEE_BPS=100
```

### Step 4: Get Blockfrost API Key

1. Go to: https://blockfrost.io/
2. Sign up for free account
3. Create a project (select "Preprod" network)
4. Copy your project ID
5. Add to `.env` files

### Step 5: Build Smart Contract

```bash
cd contracts
aiken build
aiken test
aiken address  # Copy this address for backend
```

### Step 6: Update Backend with Validator Address

Edit `backend/src/controllers/contractController.js`:

```javascript
// Replace generateContractAddress() with:
const CONTRACT_ADDRESS = "addr_test1w..."; // From 'aiken address'
```

### Step 7: Start Development Servers

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

## Wallet Setup

### Install Cardano Wallet Extension

Choose one:
- **Nami:** https://namiwallet.io/
- **Eternl:** https://eternl.io/
- **Lace:** https://www.lace.io/

### Configure for Preprod Network

1. Open wallet extension
2. Switch network to "Preprod" or "Testnet"
3. Get test ADA from faucet: https://docs.cardano.org/cardano-testnet/tools/faucet

### Important: Collateral Setup

Users need ~5 ADA as collateral for script execution:

1. In wallet, create a collateral UTxO (usually done automatically)
2. Or manually: Send 5 ADA to your own address (creates UTxO)

## Testing the Setup

### 1. Test Backend
```bash
curl http://localhost:4000/api/v1/health
# Should return: {"status":"ok",...}
```

### 2. Test Frontend
- Open: http://localhost:5173
- Should see homepage
- Click "Connect Wallet"

### 3. Test Contract
```bash
cd contracts
aiken test
# Should pass all tests
```

## Troubleshooting

### Aiken Issues
- **Command not found:** Add Aiken to PATH or restart terminal
- **Build fails:** Check Aiken version: `aiken --version`
- **Dependencies missing:** Run `aiken up` to update

### Node.js Issues
- **Port already in use:** Change PORT in `.env`
- **Module not found:** Delete `node_modules` and reinstall
- **ESM errors:** Ensure `"type": "module"` in package.json

### MongoDB Issues
- **Connection failed:** Check MONGO_URI in `.env`
- **Atlas connection:** Whitelist your IP address
- **Local MongoDB:** Ensure service is running

### Blockfrost Issues
- **401 Unauthorized:** Check BLOCKFROST_KEY
- **429 Rate limit:** Free tier has limits, wait or upgrade
- **Network mismatch:** Ensure NETWORK matches Blockfrost project

### Wallet Issues
- **Not connecting:** Check network (must be Preprod)
- **No collateral:** Create collateral UTxO (5 ADA)
- **Transaction fails:** Check you have enough ADA for fees

## Next Steps

1. ✅ All tools installed
2. ✅ Dependencies installed
3. ✅ Environment configured
4. ✅ Contract built
5. ✅ Servers running
6. 🚀 Start building features!

## Quick Reference

```bash
# Build contract
cd contracts && aiken build

# Run tests
cd contracts && aiken test

# Get validator address
cd contracts && aiken address

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Seed database
npm run seed
```

