# Cardano CLI Guide

## Do You Need Cardano CLI?

**Short answer:** **No, not required** for this project.

**Why?**
- ✅ Aiken derives validator addresses (`aiken address`)
- ✅ Mesh SDK builds transactions
- ✅ Blockfrost queries the chain
- ✅ Wallets handle signing

**When you might want it:**
- Advanced debugging
- Manual transaction inspection
- Direct chain queries (alternative to Blockfrost)
- Building transactions without Mesh SDK
- Learning Cardano internals

## Installation (If You Want It)

### Windows

**Option 1: Pre-built Binary**
1. Go to: https://github.com/IntersectMBO/cardano-node/releases
2. Download latest release (look for Windows binaries)
3. Extract `cardano-cli.exe`
4. Add to PATH or use full path

**Option 2: WSL (Windows Subsystem for Linux)**
```bash
# Install WSL, then follow Linux instructions
```

**Option 3: Docker**
```powershell
docker pull inputoutput/cardano-node:latest
docker run -it inputoutput/cardano-node cardano-cli --version
```

### macOS

**Option 1: Homebrew**
```bash
brew install cardano-node
```

**Option 2: Pre-built Binary**
1. Download from: https://github.com/IntersectMBO/cardano-node/releases
2. Extract and add to PATH

**Option 3: Build from Source**
```bash
# Requires: GHC, Cabal, libsodium
git clone https://github.com/IntersectMBO/cardano-node.git
cd cardano-node
git checkout <latest-tag>
cabal build cardano-cli
```

### Linux

**Option 1: Pre-built Binary**
```bash
# Download from releases page
wget https://github.com/IntersectMBO/cardano-node/releases/download/<version>/cardano-node-<version>-linux.tar.gz
tar -xzf cardano-node-<version>-linux.tar.gz
sudo mv cardano-cli /usr/local/bin/
```

**Option 2: Build from Source**
```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libffi-dev libgmp-dev libssl-dev libtinfo-dev libsystemd-dev zlib1g-dev

# Install GHC and Cabal (via ghcup recommended)
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh

# Build cardano-node
git clone https://github.com/IntersectMBO/cardano-node.git
cd cardano-node
git checkout <latest-tag>
cabal build cardano-cli
```

## Verify Installation

```bash
cardano-cli --version
# Should show: cardano-cli 8.x.x
```

## Useful Commands (If You Have It)

### Address Operations

```bash
# Derive validator address from script
cardano-cli address build \
  --payment-script-file contract.plutus \
  --testnet-magic 1 \
  --out-file validator.addr

# Inspect address
cardano-cli address info --address addr_test1...
```

### Transaction Building

```bash
# Build transaction (though Mesh SDK does this for you)
cardano-cli transaction build \
  --testnet-magic 1 \
  --tx-in <utxo> \
  --tx-out addr_test1...+1000000 \
  --change-address addr_test1... \
  --out-file tx.raw

# Sign transaction
cardano-cli transaction sign \
  --tx-body-file tx.raw \
  --signing-key-file payment.skey \
  --testnet-magic 1 \
  --out-file tx.signed

# Submit transaction
cardano-cli transaction submit \
  --testnet-magic 1 \
  --tx-file tx.signed
```

### Query Chain

```bash
# Query UTxOs at address
cardano-cli query utxo \
  --address addr_test1... \
  --testnet-magic 1

# Query protocol parameters
cardano-cli query protocol-parameters \
  --testnet-magic 1 \
  --out-file protocol.json
```

## Network Magic Numbers

- **Mainnet:** `--mainnet` (or `--mainnet` flag)
- **Preprod:** `--testnet-magic 1`
- **Preview:** `--testnet-magic 2`
- **Sanchonet:** `--testnet-magic 4`

## For This Project

Since we use:
- **Aiken** for contract building
- **Mesh SDK** for transactions
- **Blockfrost** for queries

You can skip Cardano CLI installation unless you want to:
- Debug transactions manually
- Learn Cardano internals
- Build transactions without Mesh SDK

## Alternative: Use Blockfrost API

Instead of Cardano CLI, you can query via Blockfrost:

```bash
# Get UTxOs at address
curl https://cardano-preprod.blockfrost.io/api/v0/addresses/addr_test1.../utxos \
  -H "project_id: YOUR_KEY"

# Get transaction info
curl https://cardano-preprod.blockfrost.io/api/v0/txs/TX_HASH \
  -H "project_id: YOUR_KEY"
```

This is what our backend already does via `blockfrost.js` service.

## Summary

**Required for this project:**
- ✅ Aiken
- ✅ Node.js
- ✅ MongoDB

**Optional but useful:**
- ⚠️ Cardano CLI (for advanced debugging)

**Not needed:**
- ❌ cardano-node (we use Blockfrost)
- ❌ Running a local node (we use Blockfrost)

