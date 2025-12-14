// Enhanced security headers middleware
const securityHeaders = (req, res, next) => {
  // Content Security Policy
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self' https:; object-src 'none'; media-src 'self'; frame-src 'none';",
    
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Content Type sniffing protection
    'X-Content-Type-Options': 'nosniff',
    
    // Frame protection
    'X-Frame-Options': 'DENY',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // HSTS (only in production)
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }),
    
    // Remove server information
    'X-Powered-By': undefined,
    'Server': undefined,
    
    // Cache control for API responses
    'Cache-Control': req.path.startsWith('/api/') ? 'no-store, no-cache, must-revalidate, proxy-revalidate' : undefined,
    
    // Permissions Policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
  });

  // Remove headers that might leak information
  res.removeHeader('X-Powered-By');
  
  next();
};

export default securityHeaders;
