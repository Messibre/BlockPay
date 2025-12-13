import Contract from '../models/Contract.js';
import { verifyDeposit, verifyPayout } from '../services/chainVerifier.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

// Get configured contract address (use env var for deployed script), otherwise keep fallback
const generateContractAddress = () => {
  return (
    process.env.ESCROW_SCRIPT_ADDRESS ||
    'addr_test1wqhuaxvd0x5dyunjlzmc7nsrxur4x5s9xlnvlrwjgefg0qstf3kqv'
  );
};

export const createContract = async (req, res, next) => {
  try {
    const { jobId, freelancerId, totalAmount, milestones, feePayer } = req.body;

    if (!jobId || !freelancerId || !totalAmount || !milestones || !Array.isArray(milestones)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const milestoneSum = milestones.reduce((sum, m) => sum + m.amount, 0);
    if (milestoneSum !== totalAmount) {
      return res.status(400).json({
        message: `Milestone sum (${milestoneSum}) must equal totalAmount (${totalAmount})`,
      });
    }

    const contractAddress = generateContractAddress();

    // Get client and freelancer addresses from User model
    const [clientUser, freelancerUser] = await Promise.all([
      User.findById(req.userId),
      User.findById(freelancerId),
    ]);

    const clientAddress = clientUser?.walletAddress || 'addr_test1...';
    const freelancerAddress = freelancerUser?.walletAddress || 'addr_test1...';

    const contractDatum = {
      client: clientAddress,
      freelancer: freelancerAddress,
      amount: totalAmount,
      milestones: milestones.map((m) => ({
        id: m.id,
        amount: m.amount,
        paid: false,
      })),
      totalAmount,
      contractNonce: Date.now(),
      feePercent: Number(process.env.PLATFORM_FEE_BPS) || 100,
      feeAddress: process.env.PLATFORM_FEE_ADDRESS || null,
      status: 'locked',
    };

    const contract = new Contract({
      projectId: jobId,
      clientId: req.userId,
      freelancerId,
      contractAddress,
      datum: contractDatum,
      totalAmount,
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description || '',
        amount: m.amount,
        dueDate: m.dueDate ? new Date(m.dueDate) : null,
        status: 'pending',
      })),
      feePayer: feePayer || 'client',
      offchainState: 'PENDING',
    });

    await contract.save();

    res.status(201).json({
      contractId: contract._id,
      contractAddress: contract.contractAddress,
      contractDatum,
      depositInstructions: {
        amountRequired: totalAmount,
        contractAddress,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('clientId', 'fullName walletAddress')
      .populate('freelancerId', 'fullName walletAddress')
      .populate('projectId', 'title description');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const deposits = await Payment.find({
      contractId: contract._id,
      paymentType: 'deposit',
    }).sort({ createdAt: -1 });

    res.json({
      ...contract.toObject(),
      deposits,
    });
  } catch (error) {
    next(error);
  }
};

export const recordDeposit = async (req, res, next) => {
  try {
    const { txHash, amount } = req.body;
    const contractId = req.params.id;

    if (!txHash || !amount) {
      return res.status(400).json({ message: 'txHash and amount required' });
    }

    // Check for duplicate
    const existing = await Payment.findOne({ txHash });
    if (existing) {
      return res.status(409).json({ message: 'Transaction already recorded' });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Verify on-chain
    const verification = await verifyDeposit(txHash, contract.contractAddress, amount);

    if (!verification.valid) {
      // Allow PENDING transactions (mempool)
      if (verification.status !== 'PENDING') {
        return res.status(422).json({
          message: 'Transaction verification failed',
          error: verification.error,
          status: verification.status,
        });
      }
    }

    // Create payment record
    const payment = new Payment({
      contractId,
      paymentType: 'deposit',
      amountADA: verification.amount,
      txHash,
      status: verification.status || 'CONFIRMED',
      blockTime: verification.blockTime,
      blockHeight: verification.blockHeight,
      explorerLink: verification.explorerLink,
      toAddress: contract.contractAddress,
    });

    await payment.save();

    // Update contract state
    contract.offchainState = 'FUNDED';
    await contract.save();

    res.json({
      status: payment.status,
      txHash,
      explorerLink: payment.explorerLink,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeposits = async (req, res, next) => {
  try {
    const deposits = await Payment.find({
      contractId: req.params.id,
      paymentType: 'deposit',
    }).sort({ createdAt: -1 });

    res.json(deposits);
  } catch (error) {
    next(error);
  }
};

export const approveMilestone = async (req, res, next) => {
  try {
    const { milestoneId } = req.params;
    const { txHash } = req.body;
    const contractId = req.params.id;

    const contract = await Contract.findById(contractId).populate('freelancerId', 'walletAddress');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Verify client owns this contract
    if (contract.clientId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the client can approve milestones' });
    }

    // Find milestone
    const milestone = contract.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    if (milestone.status !== 'submitted') {
      return res.status(400).json({
        message: `Milestone must be submitted before approval. Current status: ${milestone.status}`,
      });
    }

    // If txHash provided, verify the release transaction
    if (txHash) {
      const freelancerAddress = contract.freelancerId.walletAddress;
      const milestoneAmount = milestone.amount;
      const feePercent = contract.datum.feePercent || 100;
      const feeAmount = Math.floor((milestoneAmount * feePercent) / 10000);
      const payoutAmount = milestoneAmount - feeAmount;

      // Verify payout to freelancer and platform fee (if configured)
      const platformFeeAddress = process.env.PLATFORM_FEE_ADDRESS || null;
      const verification = await verifyPayout(
        txHash,
        freelancerAddress,
        payoutAmount,
        platformFeeAddress,
        feeAmount,
      );

      if (!verification.valid) {
        return res.status(422).json({
          message: 'Transaction verification failed',
          error: verification.error,
          status: verification.status,
        });
      }

      // Record payment
      const payment = new Payment({
        contractId,
        milestoneId,
        paymentType: 'release',
        amountADA: payoutAmount,
        txHash,
        status: verification.status || 'CONFIRMED',
        blockTime: verification.blockTime,
        blockHeight: verification.blockHeight,
        explorerLink: verification.explorerLink,
        fromAddress: contract.contractAddress,
        toAddress: freelancerAddress,
        feeAmount: feeAmount > 0 ? feeAmount : undefined,
        feeAddress: platformFeeAddress || undefined,
      });

      await payment.save();
    }

    // Update milestone status
    milestone.status = 'approved';
    milestone.approvedAt = new Date();

    // Update datum milestone to paid
    const datumMilestone = contract.datum.milestones.find((m) => m.id === milestoneId);
    if (datumMilestone) {
      datumMilestone.paid = true;
    }

    await contract.save();

    res.json({
      message: 'Milestone approved successfully',
      milestone: {
        id: milestone.id,
        status: milestone.status,
        approvedAt: milestone.approvedAt,
      },
      txHash: txHash || null,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyContracts = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {
      $or: [{ clientId: req.userId }, { freelancerId: req.userId }],
    };
    if (status) {
      query.offchainState = status.toUpperCase();
    }

    const contracts = await Contract.find(query)
      .populate('clientId', 'fullName email')
      .populate('freelancerId', 'fullName email')
      .populate('projectId', 'title')
      .sort({ createdAt: -1 });

    res.json({ contracts });
  } catch (error) {
    next(error);
  }
};
