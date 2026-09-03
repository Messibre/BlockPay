import Job from '../models/Job.js';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import Proposal from '../models/Proposal.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (req.userRole === 'freelancer') {
      const [activeContracts, pendingProposals, freelancerContracts] = await Promise.all([
        Contract.countDocuments({
          freelancerId: userId,
          offchainState: { $in: ['FUNDED', 'ACTIVE'] },
        }),
        Proposal.countDocuments({ freelancerId: userId, status: 'pending' }),
        Contract.find({ freelancerId: userId }).distinct('_id'),
      ]);

      const paymentMatch = {
        contractId: { $in: freelancerContracts },
        paymentType: { $in: ['release', 'payout'] },
        status: 'CONFIRMED',
      };
      const [earnings] = await Payment.aggregate([
        { $match: paymentMatch },
        { $group: { _id: null, totalEarnings: { $sum: '$amountADA' } } },
      ]);
      const recentPayments = await Payment.find(paymentMatch)
        .sort({ blockTime: -1, createdAt: -1 })
        .limit(5)
        .select('contractId milestoneId amountADA txHash explorerLink blockTime createdAt status')
        .lean();

      return res.json({
        jobsRecommended: 0,
        activeContracts,
        pendingProposals,
        totalEarnings: earnings?.totalEarnings || 0,
        recentPayments,
      });
    }

    const [activeJobs, pendingContracts, completedContracts, clientContracts] =
      await Promise.all([
        Job.countDocuments({
          clientId: userId,
          status: { $in: ['open', 'in_progress'] },
        }),
        Contract.countDocuments({
          clientId: userId,
          offchainState: { $in: ['PENDING', 'FUNDED', 'ACTIVE'] },
        }),
        Contract.countDocuments({ clientId: userId, offchainState: 'COMPLETED' }),
        Contract.find({ clientId: userId }).distinct('_id'),
      ]);

    const [paymentStats] = await Payment.aggregate([
      {
        $match: {
          contractId: { $in: clientContracts },
          paymentType: 'release',
          status: 'CONFIRMED',
        },
      },
      { $group: { _id: null, totalPaid: { $sum: '$amountADA' } } },
    ]);

    return res.json({
      activeJobs,
      pendingContracts,
      completedContracts,
      totalPaid: paymentStats?.totalPaid || 0,
    });
  } catch (error) {
    next(error);
  }
};
