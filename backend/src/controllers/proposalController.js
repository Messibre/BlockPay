import Proposal from '../models/Proposal.js';
import Job from '../models/Job.js';
import Contract from '../models/Contract.js';
import User from '../models/User.js';

export const submitProposal = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { coverLetter, bidAmount, timeline, attachments, portfolioLinks } = req.body;

    if (!coverLetter || !bidAmount) {
      return res.status(400).json({ message: 'Cover letter and bid amount required' });
    }

    // Check if job exists and is open
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ message: 'Job is not accepting proposals' });
    }

    // Check if bid is within budget range
    if (bidAmount < job.budgetMin || bidAmount > job.budgetMax) {
      return res.status(400).json({
        message: `Bid amount must be between ${job.budgetMin / 1000000} and ${job.budgetMax / 1000000} ADA`,
      });
    }

    // Check if freelancer already submitted a proposal
    const existingProposal = await Proposal.findOne({
      jobId,
      freelancerId: req.userId,
    });

    if (existingProposal) {
      return res
        .status(409)
        .json({ message: 'You have already submitted a proposal for this job' });
    }

    const proposal = new Proposal({
      jobId,
      freelancerId: req.userId,
      coverLetter,
      bidAmount,
      timeline,
      attachments: attachments || [],
      portfolioLinks: portfolioLinks || [],
      status: 'pending',
    });

    await proposal.save();

    res.status(201).json({
      proposalId: proposal._id,
      message: 'Proposal submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getProposals = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status } = req.query;

    // Verify job exists and user has access
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Only job owner can see proposals
    if (job.clientId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = { jobId };
    if (status) {
      query.status = status;
    }

    const proposals = await Proposal.find(query)
      .populate('freelancerId', 'fullName email walletAddress skills rating')
      .sort({ createdAt: -1 });

    res.json({ proposals });
  } catch (error) {
    next(error);
  }
};

export const getMyProposals = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { freelancerId: req.userId };
    if (status) {
      query.status = status;
    }

    const proposals = await Proposal.find(query)
      .populate('jobId', 'title description budgetMin budgetMax status')
      .sort({ createdAt: -1 });

    res.json({ proposals });
  } catch (error) {
    next(error);
  }
};

export const acceptProposal = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const { milestones, feePayer } = req.body;

    const proposal = await Proposal.findById(proposalId).populate('jobId');
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    // Verify job owner
    if (proposal.jobId.clientId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only job owner can accept proposals' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Proposal is not pending' });
    }

    // Validate milestones
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ message: 'At least one milestone is required' });
    }

    const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
    if (totalAmount !== proposal.bidAmount) {
      return res.status(400).json({
        message: `Milestone sum (${totalAmount}) must equal proposal bid amount (${proposal.bidAmount})`,
      });
    }

    // Use configured escrow script address when available, otherwise fallback to placeholder
    const contractAddress =
      process.env.ESCROW_SCRIPT_ADDRESS || `addr_test1${Math.random().toString(36).substring(7)}`;

    // Get addresses
    const [client, freelancer] = await Promise.all([
      User.findById(req.userId),
      User.findById(proposal.freelancerId),
    ]);

    const contractDatum = {
      client: client?.walletAddress || 'addr_test1...',
      freelancer: freelancer?.walletAddress || 'addr_test1...',
      amount: proposal.bidAmount,
      milestones: milestones.map((m) => ({
        id: m.id || `milestone_${Date.now()}_${Math.random()}`,
        amount: m.amount,
        paid: false,
      })),
      totalAmount: proposal.bidAmount,
      contractNonce: Date.now(),
      feePercent: Number(process.env.PLATFORM_FEE_BPS) || 100,
      feeAddress: process.env.PLATFORM_FEE_ADDRESS || null,
      status: 'locked',
    };

    // Create contract
    const contract = new Contract({
      projectId: proposal.jobId._id,
      clientId: req.userId,
      freelancerId: proposal.freelancerId,
      contractAddress,
      datum: contractDatum,
      totalAmount: proposal.bidAmount,
      milestones: milestones.map((m) => ({
        id: m.id || `milestone_${Date.now()}_${Math.random()}`,
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

    // Update proposal status
    proposal.status = 'accepted';
    proposal.acceptedAt = new Date();
    proposal.contractId = contract._id;
    await proposal.save();

    // Update job status
    proposal.jobId.status = 'in_progress';
    await proposal.jobId.save();

    res.status(201).json({
      contractId: contract._id,
      contractAddress: contract.contractAddress,
      contractDatum,
      depositInstructions: {
        amountRequired: proposal.bidAmount,
        contractAddress,
      },
      message: 'Proposal accepted and contract created',
    });
  } catch (error) {
    next(error);
  }
};

export const rejectProposal = async (req, res, next) => {
  try {
    const { proposalId } = req.params;

    const proposal = await Proposal.findById(proposalId).populate('jobId');
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    if (proposal.jobId.clientId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only job owner can reject proposals' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Proposal is not pending' });
    }

    proposal.status = 'rejected';
    proposal.rejectedAt = new Date();
    await proposal.save();

    res.json({ message: 'Proposal rejected' });
  } catch (error) {
    next(error);
  }
};
