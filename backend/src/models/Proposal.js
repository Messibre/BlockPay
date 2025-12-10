import mongoose from 'mongoose';

const proposalSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    freelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coverLetter: {
      type: String,
      required: true,
    },
    bidAmount: {
      type: Number, // lovelace
      required: true,
    },
    timeline: {
      type: String, // e.g., "2 weeks", "1 month"
    },
    attachments: [String], // URLs
    portfolioLinks: [String],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    acceptedAt: Date,
    rejectedAt: Date,
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
proposalSchema.index({ jobId: 1, status: 1 });
proposalSchema.index({ freelancerId: 1, status: 1 });
proposalSchema.index({ jobId: 1, freelancerId: 1 }, { unique: true }); // One proposal per freelancer per job

export default mongoose.model('Proposal', proposalSchema);
