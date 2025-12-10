import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true, // Allow null for wallet-only users
    },
    passwordHash: {
      type: String,
      required: false, // Optional for wallet-only users
    },
    role: {
      type: String,
      enum: ['freelancer', 'client'],
      required: true,
    },
    walletAddress: {
      type: String,
      required: true,
      index: true,
    },
    wallets: [
      {
        address: String,
        pubkeyhash: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    country: {
      type: String,
      trim: true,
    },
    skills: [String], // For freelancers
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ walletAddress: 1 });

export default mongoose.model('User', userSchema);
