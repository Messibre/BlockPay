import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    milestoneId: String,
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    evidence: [String], // URLs/files
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved"],
      default: "open",
      index: true,
    },
    resolution: {
      decision: {
        type: String,
        enum: ["refund", "pay_partial", "pay_full"],
      },
      distribution: [
        {
          userId: mongoose.Schema.Types.ObjectId,
          amount: Number, // lovelace
        },
      ],
      evidence: String,
      resolvedBy: mongoose.Schema.Types.ObjectId,
      resolvedAt: Date,
    },
  },
  {
    timestamps: true,
  },
);

disputeSchema.index({ contractId: 1, status: 1 });
disputeSchema.index({ status: 1 });

export default mongoose.model("Dispute", disputeSchema);

