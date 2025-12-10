# Cardano Escrow Contracts

Aiken smart contracts for the Cardano Freelance Escrow platform.

## Structure

- `validators/escrow.ak` - Main escrow validator (includes types, validator logic, and tests)
- `aiken.toml` - Aiken project configuration

## Building

1. Install Aiken: `aiken up`
2. Build: `aiken build`
3. Test: `aiken test`

## Validator Address

After building, get the validator address:
```bash
aiken address
```

Or use the compiled script to derive programmatically.

## Contract Overview

The escrow validator handles secure payments between clients and freelancers with the following features:

### Actions (Redeemers)

1. **Deposit** - Client funds the escrow
   - No validation needed (funds just sent to script address)
   - Amount verified off-chain

2. **Release** - Client approves a milestone
   - Requires client signature
   - Milestone must exist and not be paid
   - Marks milestone as ready for withdrawal

3. **Withdraw** - Freelancer withdraws released funds
   - Requires freelancer signature
   - Milestone must be marked as paid (released)
   - Funds sent to freelancer (minus platform fee)

4. **Refund** - Client gets money back
   - Requires client signature
   - Only allowed if no milestones paid OR expiration passed
   - Returns funds to client

5. **Arbitrate** - Admin/arbitrator resolves disputes
   - Requires arbitrator signature
   - Can decide: PayFull, PayPartial, RefundFull, RefundPartial
   - Overrides normal flow for dispute resolution

### Datum Structure

```aiken
EscrowDatum {
  client: ByteArray          // Client's pubkeyhash
  freelancer: ByteArray      // Freelancer's pubkeyhash
  total_amount: Int          // Total escrow amount (lovelace)
  milestones: List<Milestone> // List of milestones
  contract_nonce: Int        // Unique identifier
  fee_percent: Int           // Platform fee (basis points)
  fee_address: ByteArray     // Fee recipient
  expiration: Option<Int>    // Optional expiration
  arbitrator: ByteArray      // Arbitrator pubkeyhash
}
```

### Security Features

- **Signature Verification**: All actions require appropriate signatures
- **Milestone Tracking**: Prevents double-spending of milestones
- **Expiration Support**: Allows automatic refunds after deadline
- **Arbitration**: Admin can resolve disputes when needed
- **Fee Handling**: Platform fees calculated and routed correctly

## Usage in Frontend/Backend

1. **Create Contract**: Build datum with client/freelancer addresses and milestones
2. **Deposit**: Client sends ADA to validator address with inline datum
3. **Release**: Client signs transaction with `Release(milestone_id)` redeemer
4. **Withdraw**: Freelancer signs transaction with `Withdraw(milestone_id)` redeemer
5. **Refund**: Client signs transaction with `Refund` redeemer (if conditions met)
6. **Arbitrate**: Admin signs transaction with `Arbitrate(decision)` redeemer

## Testing

Run tests with:
```bash
aiken test
```

Tests cover:
- Client can release milestones
- Freelancer can withdraw after release
- Client can refund when no payments
- Arbitrator can resolve disputes
- Security checks (unauthorized access prevented)

## Deployment

1. Build the contract: `aiken build`
2. Get validator address: `aiken address`
3. Update backend with validator address
4. Deploy to Cardano preprod/testnet first
5. Test thoroughly before mainnet

## Notes

- All amounts are in **lovelace** (1 ADA = 1,000,000 lovelace)
- Platform fee is in **basis points** (100 = 1%)
- Collateral required: Ensure users have ~5 ADA collateral UTxO for script execution
- Network: Designed for Cardano preprod/testnet initially
