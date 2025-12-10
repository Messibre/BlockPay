import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    milestoneId: String, // Optional, links to milestone
    paymentType: {
      type: String,
      enum: ["deposit", "release", "refund", "payout"],
      required: true,
    },
    amountADA: {
      type: Number, // lovelace
      required: true,
    },
    txHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    blockTime: Date,
    blockHeight: Number,
    explorerLink: String,
    fromAddress: String,
    toAddress: String,
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ contractId: 1, paymentType: 1 });
paymentSchema.index({ txHash: 1 }, { unique: true });

export default mongoose.model("Payment", paymentSchema);

