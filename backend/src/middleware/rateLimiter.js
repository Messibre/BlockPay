// Simple rate limiting middleware using in-memory storage
const rateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (requests.has(clientIP)) {
      const userRequests = requests.get(clientIP);
      const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
      requests.set(clientIP, validRequests);
    } else {
      requests.set(clientIP, []);
    }

    const userRequests = requests.get(clientIP);

    if (userRequests.length >= max) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(clientIP, userRequests);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - userRequests.length),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });

    next();
  };
};

// Stricter rate limiting for authentication endpoints
const authRateLimiter = rateLimiter(15 * 60 * 1000, 20); // 20 attempts per 15 minutes

// Very strict rate limiting for sensitive operations
const strictRateLimiter = rateLimiter(15 * 60 * 1000, 3); // 3 attempts per 15 minutes

export { rateLimiter, authRateLimiter, strictRateLimiter };
