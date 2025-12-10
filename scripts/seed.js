import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../backend/src/models/User.js";
import Job from "../backend/src/models/Job.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/cardano-escrow";

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Job.deleteMany({});

    // Create sample client
    const client = new User({
      fullName: "John Client",
      email: "client@example.com",
      passwordHash: "$2a$10$dummyhash", // In production, use bcrypt
      role: "client",
      walletAddress: "addr_test1qq...",
      wallets: [{ address: "addr_test1qq...", isPrimary: true }],
    });
    await client.save();

    // Create sample freelancer
    const freelancer = new User({
      fullName: "Jane Freelancer",
      email: "freelancer@example.com",
      passwordHash: "$2a$10$dummyhash",
      role: "freelancer",
      walletAddress: "addr_test1qq...",
      wallets: [{ address: "addr_test1qq...", isPrimary: true }],
      skills: ["design", "development"],
    });
    await freelancer.save();

    // Create sample job
    const job = new Job({
      clientId: client._id,
      title: "Logo Design Needed",
      description: "Looking for a professional logo design for my startup.",
      budgetMin: 5000000, // 5 ADA
      budgetMax: 10000000, // 10 ADA
      currency: "ADA",
      tags: ["design", "logo"],
      visibility: "public",
      status: "open",
    });
    await job.save();

    console.log("Seed data created:");
    console.log(`- Client: ${client.fullName} (${client.email})`);
    console.log(`- Freelancer: ${freelancer.fullName} (${freelancer.email})`);
    console.log(`- Job: ${job.title}`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();

