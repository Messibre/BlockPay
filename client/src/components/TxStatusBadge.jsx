const colors = {
  pending: "badge badge-pending",
  confirmed: "badge badge-confirmed",
  failed: "badge badge-failed",
};

export function TxStatusBadge({ status = "pending" }) {
  return <span className={colors[status] || colors.pending}>{status}</span>;
}
