import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import messageSigning from '@emurgo/cardano-message-signing-nodejs';
const { verifyMessage } = messageSigning;

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const register = async (req, res, next) => {
  try {
    const { email, password, displayName, role, walletAddress } = req.body;

    if (!displayName || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (email && password) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: 'Email already registered' });
      }
    }

    // Only check for existing wallet if walletAddress is provided
    const isValidAddress = (a) => typeof a === 'string' && /^(addr1|addr_test1)[0-9a-z]+$/.test(a);
    if (walletAddress) {
      if (!isValidAddress(walletAddress)) {
        return res.status(400).json({ message: 'Invalid wallet address format' });
      }
      const existingWallet = await User.findOne({ walletAddress });
      if (existingWallet) {
        return res.status(409).json({ message: 'Wallet already registered' });
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const userData = {
      fullName: displayName,
      email: email || null,
      passwordHash,
      role,
      walletAddress: walletAddress || null,
    };

    // Only add wallets array if walletAddress is provided
    if (walletAddress) {
      userData.wallets = [{ address: walletAddress, isPrimary: true }];
    }

    const user = new User(userData);

    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      token,
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
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      token,
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
};

export const verifyWallet = async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const isValidAddress = (a) => typeof a === 'string' && /^(addr1|addr_test1)[0-9a-z]+$/.test(a);
    if (!isValidAddress(address)) {
      return res.status(400).json({ message: 'Invalid wallet address format' });
    }
    // Verify signature using emurgo library (CIP-30 signatures)
    let valid = false;
    try {
      valid = verifyMessage(signature, address, message);
    } catch (e) {
      // Keep valid=false
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
        if (!user.wallets?.some((w) => w.address === address)) {
          user.wallets = user.wallets || [];
          user.wallets.push({ address, isPrimary: user.wallets.length === 0 });
        }
        // Set walletAddress if missing
        if (!user.walletAddress) user.walletAddress = address;

        await user.save();

        const newToken = generateToken(user._id, user.role);
        return res.json({
          token: newToken,
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
        // fall through to create/find user behavior
      }
    }

    // No auth token, behave as login/signup via wallet
    let user = await User.findOne({ wallets: { $elemMatch: { address } } });

    if (!user) {
      // Create wallet-only user
      user = new User({
        fullName: `Wallet ${address.slice(0, 8)}...`,
        email: null,
        passwordHash: null,
        role: 'client', // Default, can be updated later
        walletAddress: address,
        wallets: [{ address, isPrimary: true }],
      });
      await user.save();
    }

    const token = generateToken(user._id, user.role);

    res.json({
      token,
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
};

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

export const updateMe = async (req, res, next) => {
  try {
    const { displayName, email } = req.body;
    const updates = {};

    if (displayName) updates.fullName = displayName;
    if (email) updates.email = email;

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    }).select('-passwordHash');

    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).select('-passwordHash -wallets');
    res.json(users);
  } catch (error) {
    next(error);
  }
};
