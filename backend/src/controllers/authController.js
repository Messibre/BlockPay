import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import messageSigning from '@emurgo/cardano-message-signing-nodejs';
import { validateRequest, sanitize, schemas } from '../middleware/validation.js';
const { verifyMessage } = messageSigning;

const generateToken = (userId, role) => {
  // Shorter token expiration for better security
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

const generateRefreshToken = (userId, role) => {
  return jwt.sign({ userId, role, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const register = [
  validateRequest(schemas.register),
  async (req, res, next) => {
    try {
      const { email, password, displayName, role, walletAddress } = req.body;

      // Additional validation after sanitization
      if (!displayName || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Sanitize inputs
      const sanitizedEmail = email ? sanitize.email(email) : null;
      const sanitizedWalletAddress = walletAddress ? sanitize.walletAddress(walletAddress) : null;

      if (email && password) {
        const existing = await User.findOne({ email: sanitizedEmail });
        if (existing) {
          return res.status(409).json({ message: 'Email already registered' });
        }
      }

      if (sanitizedWalletAddress) {
        const existingWallet = await User.findOne({ walletAddress: sanitizedWalletAddress });
        if (existingWallet) {
          return res.status(409).json({ message: 'Wallet already registered' });
        }
      }

      const passwordHash = password ? await bcrypt.hash(password, 12) : null; // Increased rounds

      const userData = {
        fullName: sanitize.html(displayName),
        email: sanitizedEmail,
        passwordHash,
        role,
        walletAddress: sanitizedWalletAddress,
      };

      if (sanitizedWalletAddress) {
        userData.wallets = [{ address: sanitizedWalletAddress, isPrimary: true }];
      }

      const user = new User(userData);
      await user.save();

      const token = generateToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id, user.role);

      res.status(201).json({
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
        },
      });
    } catch (error) {
      next(error);
    }
  },
];

export const login = [
  validateRequest(schemas.login),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Sanitize email
      const sanitizedEmail = sanitize.email(email);

      const user = await User.findOne({ email: sanitizedEmail });
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id, user.role);

      res.json({
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
        },
      });
    } catch (error) {
      next(error);
    }
  },
];

export const verifyWallet = [
  validateRequest(schemas.verifyWallet),
  async (req, res, next) => {
    try {
      const { address, signature, message } = req.body;

      // Sanitize inputs
      const sanitizedAddress = sanitize.walletAddress(address);
      const sanitizedMessage = sanitize.html(message);

      // Verify signature using emurgo library (CIP-30 signatures)
      let valid = false;
      try {
        valid = verifyMessage(signature, sanitizedAddress, sanitizedMessage);
      } catch (e) {
        console.warn('Signature verification error', e.message || e);
      }

      if (!valid) {
        return res.status(400).json({ message: 'Signature verification failed' });
      }

      // If an Authorization token is present, link wallet to that user
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(payload.userId);
          if (!user) return res.status(404).json({ message: 'User not found' });

          // Prevent duplicate
          if (!user.wallets?.some((w) => w.address === sanitizedAddress)) {
            user.wallets = user.wallets || [];
            user.wallets.push({ address: sanitizedAddress, isPrimary: user.wallets.length === 0 });
          }
          // Set walletAddress if missing
          if (!user.walletAddress) user.walletAddress = sanitizedAddress;

          await user.save();

          const newToken = generateToken(user._id, user.role);
          const newRefreshToken = generateRefreshToken(user._id, user.role);

          return res.json({
            token: newToken,
            refreshToken: newRefreshToken,
            user: {
              id: user._id,
              name: user.fullName,
              email: user.email,
              role: user.role,
              walletAddress: user.walletAddress,
              wallets: user.wallets,
            },
          });
        } catch (e) {
          console.warn('Auth token invalid for wallet link', e.message || e);
        }
      }

      // No auth token, behave as login/signup via wallet
      let user = await User.findOne({ wallets: { $elemMatch: { address: sanitizedAddress } } });

      if (!user) {
        // Create wallet-only user
        user = new User({
          fullName: `Wallet ${sanitizedAddress.slice(0, 8)}...`,
          email: null,
          passwordHash: null,
          role: 'client',
          walletAddress: sanitizedAddress,
          wallets: [{ address: sanitizedAddress, isPrimary: true }],
        });
        await user.save();
      }

      const token = generateToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id, user.role);

      res.json({
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
          wallets: user.wallets,
        },
      });
    } catch (error) {
      next(error);
    }
  },
];

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateMe = [
  validateRequest({
    body: {
      displayName: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', pattern: 'email', maxLength: 255 },
    },
  }),
  async (req, res, next) => {
    try {
      const { displayName, email } = req.body;
      const updates = {};

      if (displayName) updates.fullName = sanitize.html(displayName);
      if (email) updates.email = sanitize.email(email);

      const user = await User.findByIdAndUpdate(req.userId, updates, {
        new: true,
        runValidators: true,
      }).select('-passwordHash');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
];

export const getUsers = async (req, res, next) => {
  try {
    const { role, search, limit = 50, page = 1 } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      const sanitizedSearch = sanitize.html(search);
      query.$or = [
        { fullName: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    // Add pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const users = await User.find(query)
      .select('-passwordHash -wallets')
      .limit(limitNum)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
