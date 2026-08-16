const rateLimit = require('express-rate-limit');

// Limits repeated login attempts for the same identifier (phone or admin
// email) within a time window, independent of IP address - slows down
// password brute-forcing without punishing many different users who
// happen to share one IP (e.g. behind carrier NAT).
const makeLoginRateLimiter = (identifierField) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    keyGenerator: (req) => req.body[identifierField] || req.ip,
    message: {
      success: false,
      message: 'Too many login attempts. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

module.exports = {
  userLoginRateLimiter: makeLoginRateLimiter('phone'),
  adminLoginRateLimiter: makeLoginRateLimiter('email'),
};