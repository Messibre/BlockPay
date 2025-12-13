
import Job from '../models/Job.js';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Active Jobs
    const activeJobs = await Job.countDocuments({
      clientId: userId,
      status: { $in: ['open', 'in_progress'] },
    });

    // Pending Contracts
    const pendingContracts = await Contract.countDocuments({
      clientId: userId,
      offchainState: { $in: ['PENDING', 'FUNDED', 'ACTIVE'] },
    });

    // Completed Contracts
    const completedContracts = await Contract.countDocuments({
      clientId: userId,
      offchainState: 'COMPLETED',
    });

    // Total Paid
    // 1. Find all contracts for this client
    const clientContracts = await Contract.find({ clientId: userId }).distinct('_id');
    
    // 2. Aggregate payments for these contracts
    const layoutStats = await Payment.aggregate([
      {
        $match: {
          contractId: { $in: clientContracts },
          paymentType: 'release',
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amountADA' },
        },
      },
    ]);

    const totalPaid = layoutStats.length > 0 ? layoutStats[0].totalPaid : 0;

    // Convert Lovelace to ADA (1 ADA = 1,000,000 Lovelace) for display
    const totalPaidADA = totalPaid / 1000000;

    res.json({
      activeJobs,
      pendingContracts,
      completedContracts,
      totalPaid: totalPaidADA,
    });
  } catch (error) {
    next(error);
  }
};
