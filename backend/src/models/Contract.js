import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  amount: { type: Number, required: true }, // lovelace
  dueDate: Date,
  status: {
    type: String,
    enum: ["pending", "submitted", "approved", "paid", "disputed"],
    default: "pending",
  },
  files: [String], // URLs
  notes: String,
  submittedAt: Date,
  approvedAt: Date,
  paidAt: Date,
});

const contractSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    freelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Blockchain data
    escrowUtxo: String, // UTxO reference
    validatorHash: String, // Aiken script hash
    contractAddress: {
      type: String,
      required: true,
      index: true,
    },
    datum: {
      client: String, // ByteArray/Address
      freelancer: String,
      amount: Number, // lovelace
      milestones: [
        {
          id: String,
          amount: Number,
          paid: Boolean,
        },
      ],
      totalAmount: Number,
      contractNonce: Number,
      feePercent: Number,
      expiration: Date, // POSIXTime
      status: {
        type: String,
        enum: ["locked", "released", "refunded"],
        default: "locked",
      },
    },
    totalAmount: {
      type: Number, // lovelace
      required: true,
    },
    milestones: [milestoneSchema],
    feePayer: {
      type: String,
      enum: ["client", "freelancer"],
      default: "client",
    },
    offchainState: {
      type: String,
      enum: ["PENDING", "FUNDED", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

contractSchema.index({ projectId: 1, offchainState: 1 });
contractSchema.index({ clientId: 1, offchainState: 1 });
contractSchema.index({ freelancerId: 1, offchainState: 1 });

export default mongoose.model("Contract", contractSchema);

