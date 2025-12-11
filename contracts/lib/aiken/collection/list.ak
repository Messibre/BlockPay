// Minimal shim for `aiken/collection/list` so local builds work offline
pub fn has(list: List<ByteArray>, item: ByteArray) -> Bool {
  when list is {
    [] -> False
    [h, ..t] -> {
      when h == item is {
        True -> True
        False -> has(t, item)
      }
    }
  }
}
