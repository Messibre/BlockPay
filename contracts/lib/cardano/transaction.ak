// Minimal shim for `cardano/transaction` used by the validator/tests
pub type OutputReference {
  tx_id: ByteArray,
  index: Int,
}

pub type ValidRange {
  start: Int,
  end: Int,
}

pub type Transaction {
  extra_signatories: List<ByteArray>,
  valid_range: ValidRange,
}

pub const placeholder: Transaction = Transaction {
  extra_signatories: [],
  valid_range: ValidRange { start: 0, end: 0 },
}
