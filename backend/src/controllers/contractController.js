import Contract from '../models/Contract.js';
import { verifyDeposit } from '../services/chainVerifier.js';
import Payment from '../models/Payment.js';

// Generate contract address (simplified - in production, derive from validator)
const generateContractAddress = () => {
  // This should be derived from the compiled Aiken validator
  // For now, return a placeholder
  return `addr_test1${Math.random().toString(36).substring(7)}`;
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

    // Get client and freelancer addresses (simplified)
    // In production, fetch from User model
    const clientAddress = 'addr_test1...'; // TODO: get from req.userId
    const freelancerAddress = 'addr_test1...'; // TODO: get from freelancerId

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
      return res.status(422).json({
        message: 'Transaction verification failed',
        error: verification.error,
        status: verification.status,
      });
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
