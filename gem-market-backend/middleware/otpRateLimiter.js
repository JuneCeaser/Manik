const rateLimit = require('express-rate-limit');

// Every OTP send costs real money, so this limits how often the same
// phone number can request a new code - independent of IP address.
const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  keyGenerator: (req) => req.body.phone || req.ip,
  message: {
    success: false,
    message: 'Too many OTP requests for this number. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = otpRateLimiter;
