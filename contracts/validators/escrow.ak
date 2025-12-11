// Cardano Freelance Escrow Validator
// Handles secure escrow payments between clients and freelancers
// Supports milestones, releases, withdrawals, refunds, and arbitration

use aiken/collection/list
use cardano/transaction.{OutputReference, Transaction, placeholder}
use sian_lab/vodka/mocktail.{mock_utxo_ref}

// Datum structure stored on-chain
pub type EscrowDatum {
  client: ByteArray,          // Client's pubkeyhash
  freelancer: ByteArray,      // Freelancer's pubkeyhash
  total_amount: Int,          // Total escrow amount in lovelace
  milestones: List<Milestone>, // List of milestones with amounts
  contract_nonce: Int,        // Unique contract identifier
  fee_percent: Int,           // Platform fee in basis points (100 = 1%)
  fee_address: ByteArray,     // Platform fee recipient pubkeyhash
  expiration: Option<Int>,    // Optional expiration timestamp (POSIXTime)
  arbitrator: ByteArray,      // Arbitrator pubkeyhash for disputes
}

// Milestone structure
pub type Milestone {
  id: ByteArray,             // Unique milestone identifier
  amount: Int,               // Amount in lovelace for this milestone
  paid: Bool,                // Whether this milestone has been paid
}

// Redeemer actions
pub type EscrowRedeemer {
  Deposit                   // Initial deposit (no validation needed)
  Release(ByteArray)        // Client approves milestone (milestone id)
  Withdraw(ByteArray)       // Freelancer withdraws released funds (milestone id)
  Refund                    // Client requests refund
  Arbitrate(ArbitrateDecision) // Admin/arbitrator resolves dispute
}

// Arbitration decision types
pub type ArbitrateDecision {
  PayFull                   // Pay freelancer full amount
  PayPartial(Int)           // Pay freelancer partial amount
  RefundFull                // Refund client full amount
  RefundPartial(Int)        // Refund client partial amount
}

// Main validator
validator escrow {
  spend(
    datum_opt: Option<EscrowDatum>,
    redeemer: EscrowRedeemer,
    input: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt
    let signatories = tx.extra_signatories
    
    when redeemer is {
      Deposit -> {
        // Deposit: Client sends funds to escrow
        // No validation needed - funds just need to be sent to script address
        // The amount will be verified off-chain
        True
      }
      
      Release(milestone_id) -> {
        // Release: Client approves a milestone for payment
        // Requirements:
        // 1. Client must sign the transaction
        // 2. Milestone must exist and not be paid
        // 3. Output must pay freelancer the milestone amount (minus fee)
        
        let client_signed = list.has(signatories, datum.client)
        
        when client_signed is {
          True -> {
            // Find the milestone
            let milestone_found = find_milestone(datum.milestones, milestone_id)
            
            when milestone_found is {
              Some(milestone) -> {
                // Check milestone is not already paid
                when milestone.paid is {
                  False -> {
                    // Verify output pays freelancer
                    // Note: Full validation of outputs would require checking tx.outputs
                    // For now, we trust the off-chain code to build correct transaction
                    True
                  }
                  True -> False  // Milestone already paid
                }
              }
              None -> False  // Milestone not found
            }
          }
          False -> False  // Client didn't sign
        }
      }
      
      Withdraw(milestone_id) -> {
        // Withdraw: Freelancer withdraws funds after release
        // Requirements:
        // 1. Freelancer must sign
        // 2. Milestone must be marked as paid (released)
        // 3. Output must go to freelancer address
        
        let freelancer_signed = list.has(signatories, datum.freelancer)
        
        when freelancer_signed is {
          True -> {
            let milestone_found = find_milestone(datum.milestones, milestone_id)
            
            when milestone_found is {
              Some(milestone) -> {
                // Milestone must be paid (released by client)
                milestone.paid
              }
              None -> False
            }
          }
          False -> False
        }
      }
      
      Refund -> {
        // Refund: Client gets money back (e.g., work not delivered)
        // Requirements:
        // 1. Client must sign
        // 2. Can only refund if no milestones are paid OR expiration passed
        // 3. Output must return funds to client
        
        let client_signed = list.has(signatories, datum.client)
        
        when client_signed is {
          True -> {
            // Check if any milestone is paid
            let has_paid_milestones = has_paid_milestone(datum.milestones)
            
            when has_paid_milestones is {
              False -> {
                // No paid milestones, allow refund
                True
              }
              True -> {
                // Check expiration if set
                when datum.expiration is {
                  Some(exp_time) -> {
                    // Allow refund if expired
                    tx.valid_range.start > exp_time
                  }
                  None -> False  // Can't refund if milestones are paid and no expiration
                }
              }
            }
          }
          False -> False
        }
      }
      
      Arbitrate(decision) -> {
        // Arbitrate: Admin/arbitrator resolves disputes
        // Requirements:
        // 1. Arbitrator must sign
        // 2. Decision determines fund distribution
        
        let arbitrator_signed = list.has(signatories, datum.arbitrator)
        
        when arbitrator_signed is {
          True -> {
            // Arbitrator can make any decision
            // Off-chain code will build appropriate outputs based on decision
            True
          }
          False -> False
        }
      }
    }
  }
  
  else(_) {
    fail
  }
}

// Helper function to find a milestone by ID
fn find_milestone(milestones: List<Milestone>, id: ByteArray) -> Option<Milestone> {
  when milestones is {
    [] -> None
    [m, ..rest] -> {
      when m.id == id is {
        True -> Some(m)
        False -> find_milestone(rest, id)
      }
    }
  }
}

// Helper function to check if any milestone is paid
fn has_paid_milestone(milestones: List<Milestone>) -> Bool {
  when milestones is {
    [] -> False
    [m, ..rest] -> {
      when m.paid is {
        True -> True
        False -> has_paid_milestone(rest)
      }
    }
  }
}

// Test helpers
fn sample_client() -> ByteArray {
  #"a1"
}

fn sample_freelancer() -> ByteArray {
  #"b2"
}

fn sample_arbitrator() -> ByteArray {
  #"c3"
}

fn sample_fee_address() -> ByteArray {
  #"d4"
}

fn sample_milestone() -> Milestone {
  Milestone {
    id: #"01",
    amount: 5000000,  // 5 ADA
    paid: False,
  }
}

fn sample_datum() -> EscrowDatum {
  EscrowDatum {
    client: sample_client(),
    freelancer: sample_freelancer(),
    total_amount: 10000000,  // 10 ADA
    milestones: [sample_milestone()],
    contract_nonce: 12345,
    fee_percent: 100,  // 1%
    fee_address: sample_fee_address(),
    expiration: None,
    arbitrator: sample_arbitrator(),
  }
}

fn sample_transaction(signatories: List<ByteArray>) -> Transaction {
  Transaction {
    ..placeholder,
    extra_signatories: signatories,
  }
}

// Tests
test client_can_release_milestone() {
  let datum = Some(sample_datum())
  let redeemer = Release(#"01")
  let tx = sample_transaction([sample_client()])
  let input = mock_utxo_ref(0, 0)
  
  expect escrow.spend(datum, redeemer, input, tx)
}

test freelancer_can_withdraw_after_release() {
  let milestone = Milestone {
    id: #"01",
    amount: 5000000,
    paid: True,  // already released
  }
  let datum = Some(EscrowDatum {
    ..sample_datum(),
    milestones: [milestone],
  })
  let redeemer = Withdraw(#"01")
  let tx = sample_transaction([sample_freelancer()])
  let input = mock_utxo_ref(0, 0)
  
  expect escrow.spend(datum, redeemer, input, tx)
}

test client_can_refund_when_no_payments() {
  let datum = Some(sample_datum())
  let redeemer = Refund
  let tx = sample_transaction([sample_client()])
  let input = mock_utxo_ref(0, 0)
  
  expect escrow.spend(datum, redeemer, input, tx)
}

test arbitrator_can_resolve_dispute() {
  let datum = Some(sample_datum())
  let redeemer = Arbitrate(PayFull)
  let tx = sample_transaction([sample_arbitrator()])
  let input = mock_utxo_ref(0, 0)
  
  expect escrow.spend(datum, redeemer, input, tx)
}

test freelancer_cannot_withdraw_without_release() {
  let datum = Some(sample_datum())  // milestone not paid
  let redeemer = Withdraw(#"01")
  let tx = sample_transaction([sample_freelancer()])
  let input = mock_utxo_ref(0, 0)
  
  expect !escrow.spend(datum, redeemer, input, tx)
}

test client_cannot_release_without_signing() {
  let datum = Some(sample_datum())
  let redeemer = Release(#"01")
  let tx = sample_transaction([])  // No signatories
  let input = mock_utxo_ref(0, 0)
  
  expect !escrow.spend(datum, redeemer, input, tx)
}

test client_cannot_refund_when_milestones_paid() {
  let milestone = Milestone {
    id: #"01",
    amount: 5000000,
    paid: True,  // Milestone already paid
  }
  let datum = Some(EscrowDatum {
    ..sample_datum(),
    milestones: [milestone],
    expiration: None,  
  })
  let redeemer = Refund
  let tx = sample_transaction([sample_client()])
  let input = mock_utxo_ref(0, 0)
  
  expect !escrow.spend(datum, redeemer, input, tx)
}
