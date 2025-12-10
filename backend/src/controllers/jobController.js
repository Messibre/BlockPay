import Job from "../models/Job.js";

export const createJob = async (req, res, next) => {
  try {
    const { title, description, budgetMin, budgetMax, currency, tags, visibility } = req.body;

    if (!title || !description || !budgetMin || !budgetMax) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const job = new Job({
      clientId: req.userId,
      title,
      description,
      budgetMin,
      budgetMax,
      currency: currency || "ADA",
      tags: tags || [],
      visibility: visibility || "public",
    });

    await job.save();

    res.status(201).json({
      jobId: job._id,
      createdAt: job.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobs = async (req, res, next) => {
  try {
    const { tag, minBudget, maxBudget, page = 1, limit = 20 } = req.query;

    const query = { status: "open", visibility: "public" };

    if (tag) {
      query.tags = tag;
    }
    if (minBudget) {
      query.budgetMin = { $gte: Number(minBudget) };
    }
    if (maxBudget) {
      query.budgetMax = { $lte: Number(maxBudget) };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [jobs, total] = await Promise.all([
      Job.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip(skip),
      Job.countDocuments(query),
    ]);

    res.json({
      jobs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    next(error);
  }
};

