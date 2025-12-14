// Input validation middleware
import mongoose from 'mongoose';

// Common validation patterns
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  walletAddress: /^(addr1|addr_test1)[0-9a-z]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  hex: /^[0-9a-fA-F]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
};

// Generic validation function
const validate = (field, value, rules = {}) => {
  const errors = [];

  // Required field check
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${field} is required`);
    return errors;
  }

  // Skip other validations if field is empty and not required
  if (!value && !rules.required) {
    return errors;
  }

  // Type validation
  if (rules.type) {
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`${field} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${field} must be an object`);
        }
        break;
    }
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Length validation
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${field} must be no more than ${rules.maxLength} characters`);
    }

    // Pattern validation
    if (rules.pattern) {
      const regex = typeof rules.pattern === 'string' ? patterns[rules.pattern] : rules.pattern;
      if (regex && !regex.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
  }

  // Number-specific validations
  if (typeof value === 'number' || (!isNaN(Number(value)) && typeof value !== 'boolean')) {
    const numValue = Number(value);
    
    if (rules.min !== undefined && numValue < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && numValue > rules.max) {
      errors.push(`${field} must be no more than ${rules.max}`);
    }
  }

  // Array-specific validations
  if (Array.isArray(value)) {
    if (rules.minItems && value.length < rules.minItems) {
      errors.push(`${field} must have at least ${rules.minItems} items`);
    }
    if (rules.maxItems && value.length > rules.maxItems) {
      errors.push(`${field} must have no more than ${rules.maxItems} items`);
    }
  }

  // MongoDB ObjectId validation
  if (rules.mongodbId && !mongoose.Types.ObjectId.isValid(value)) {
    errors.push(`${field} must be a valid MongoDB ObjectId`);
  }

  return errors;
};

// Middleware factory for request validation
const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    // Validate body
    if (schema.body) {
      for (const [field, rules] of Object.entries(schema.body)) {
        const fieldErrors = validate(field, req.body[field], rules);
        errors.push(...fieldErrors);
      }
    }

    // Validate query params
    if (schema.query) {
      for (const [field, rules] of Object.entries(schema.query)) {
        const fieldErrors = validate(field, req.query[field], rules);
        errors.push(...fieldErrors);
      }
    }

    // Validate params
    if (schema.params) {
      for (const [field, rules] of Object.entries(schema.params)) {
        const fieldErrors = validate(field, req.params[field], rules);
        errors.push(...fieldErrors);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors
      });
    }

    next();
  };
};

// Sanitization functions
const sanitize = {
  // Remove dangerous characters and HTML
  html: (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  },

  // Normalize email
  email: (email) => {
    if (typeof email !== 'string') return email;
    return email.toLowerCase().trim();
  },

  // Normalize wallet address
  walletAddress: (address) => {
    if (typeof address !== 'string') return address;
    return address.trim();
  },

  // Remove null bytes and control characters
  binary: (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
};

// Middleware to sanitize input
const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize.binary(sanitize.html(req.body[key]));
      }
    }
  }

  // Sanitize query params
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitize.binary(sanitize.html(req.query[key]));
      }
    }
  }

  next();
};

// Common validation schemas
const schemas = {
  // User registration
  register: {
    body: {
      email: { type: 'string', pattern: 'email', maxLength: 255 },
      password: { type: 'string', pattern: 'password', minLength: 8, maxLength: 128 },
      displayName: { type: 'string', required: true, minLength: 2, maxLength: 100 },
      role: { type: 'string', required: true, enum: ['client', 'freelancer'] },
      walletAddress: { type: 'string', pattern: 'walletAddress', maxLength: 200 }
    }
  },

  // User login
  login: {
    body: {
      email: { type: 'string', required: true, pattern: 'email', maxLength: 255 },
      password: { type: 'string', required: true, minLength: 1, maxLength: 128 }
    }
  },

  // Wallet verification
  verifyWallet: {
    body: {
      address: { type: 'string', required: true, pattern: 'walletAddress', maxLength: 200 },
      signature: { type: 'string', required: true, minLength: 10, maxLength: 1000 },
      message: { type: 'string', required: true, minLength: 1, maxLength: 500 }
    }
  },

  // Generic ID parameter
  idParam: {
    params: {
      id: { type: 'string', required: true, mongodbId: true }
    }
  },

  // Job creation
  createJob: {
    body: {
      title: { type: 'string', required: true, minLength: 3, maxLength: 200 },
      description: { type: 'string', required: true, minLength: 10, maxLength: 5000 },
      budget: { type: 'number', required: true, min: 0 },
      deadline: { type: 'number', required: true, min: Date.now() }
    }
  },

  // Contract creation
  createContract: {
    body: {
      jobId: { type: 'string', required: true, mongodbId: true },
      freelancerId: { type: 'string', required: true, mongodbId: true },
      amount: { type: 'number', required: true, min: 1 },
      milestones: {
        type: 'array',
        required: true,
        minItems: 1,
        maxItems: 20,
        items: {
          id: { type: 'string', required: true, minLength: 1, maxLength: 100 },
          amount: { type: 'number', required: true, min: 1 },
          description: { type: 'string', required: true, minLength: 1, maxLength: 1000 }
        }
      }
    }
  }
};

export {
  validate,
  validateRequest,
  sanitizeInput,
  sanitize,
  schemas
};
