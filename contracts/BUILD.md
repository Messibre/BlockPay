# Building and Deploying the Escrow Contract

## Prerequisites

1. Install Aiken: `aiken up`
2. Ensure you have Cardano CLI tools (for address derivation)
3. Have a Cardano wallet with testnet ADA (for preprod)

## Build Steps

1. **Build the contract:**

   ```bash
   cd contracts
   aiken build
   ```

2. **Run tests:**

   ```bash
   aiken test
   ```

3. **Get validator address:**

   ```bash
   aiken address
   ```

   This will output the validator address (bech32 format) that you'll use in your backend.

4. **Get validator hash:**
   ```bash
   aiken address --hash
   ```

## Contract Address Usage

After building, you'll get a validator address like:

```
addr_test1w...
```

Use this address in:

- Backend `contractController.js` - replace `generateContractAddress()` placeholder
- Frontend - when building deposit transactions
- Blockfrost - to query UTxOs at this address

## Deploying to Preprod

1. **Fund the validator address** (for testing):

   - Send test ADA to the validator address
   - This creates a UTxO that can be spent

2. **Test deposit flow:**

   - Client sends ADA to validator with inline datum
   - Verify UTxO appears at validator address

3. **Test release/withdraw flow:**
   - Client signs Release transaction
     This file has been removed as part of repository cleanup.
     If you need build instructions later, see `docs/SETUP.md` or recreate this file.

## Integration with Backend
