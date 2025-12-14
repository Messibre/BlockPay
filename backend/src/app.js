import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';

import router from './routes/index.js';
import { ping as pingBlockfrost } from './services/blockfrost.js';
import { errorHandler } from './middleware/errorHandler.js';
import securityHeaders from './middleware/securityHeaders.js';
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput } from './middleware/validation.js';

dotenv.config();

// Environment validation
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(sanitizeInput);

// Rate limiting - apply to all API routes
app.use('/api/v1', rateLimiter(15 * 60 * 1000, 100)); // 100 requests per 15 minutes

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Enhanced CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Parse CLIENT_ORIGINS from env or use default
      const allowedOrigins = process.env.CLIENT_ORIGINS
        ? process.env.CLIENT_ORIGINS.split(',').map((o) => o.trim())
        : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

      // Allow any localhost with any port in development ONLY
      if (process.env.NODE_ENV !== 'production') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  }),
);

// Enhanced Helmet configuration
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
  }),
);

// Logging with security considerations
app.use(morgan('combined', {
  skip: (req, res) => req.url === '/health' || req.url.startsWith('/api/v1/health')
}));

// Health check endpoint (before rate limiting for monitoring)
app.get('/api/v1/health', async (_req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const bf = await pingBlockfrost().catch((e) => ({ ok: false, error: e.message }));

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      blockfrost: bf,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply auth rate limiter to authentication routes
app.use('/api/v1/auth', authRateLimiter);

// API routes
app.use('/api/v1', router);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  });
});

// Global error handler (should be last)
app.use(errorHandler);

export default app;
