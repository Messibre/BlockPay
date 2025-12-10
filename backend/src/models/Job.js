import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    budgetMin: {
      type: Number, // lovelace
      required: true,
    },
    budgetMax: {
      type: Number, // lovelace
      required: true,
    },
    budgetUSD: {
      type: Number,
    },
    budgetADA: {
      type: Number,
    },
    currency: {
      type: String,
      default: "ADA",
    },
    tags: [String],
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    attachments: [String], // URLs
    status: {
      type: String,
      enum: ["open", "in_progress", "completed", "cancelled"],
      default: "open",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

jobSchema.index({ clientId: 1, status: 1 });
jobSchema.index({ tags: 1 });
jobSchema.index({ status: 1 });

export default mongoose.model("Job", jobSchema);

