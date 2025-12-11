use cardano/transaction.{OutputReference}

// Minimal mock utilities used by the tests to create UTxO references
pub fn mock_utxo_ref(index: Int, _value: Int) -> OutputReference {
  OutputReference { tx_id: #"00", index: index }
}
