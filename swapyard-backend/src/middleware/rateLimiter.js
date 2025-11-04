const rateLimit = require("express-rate-limit");

const createRateLimiter = (opts = {}) => {
  return rateLimit({
    windowMs: opts.windowMs || 60 * 1000, // 1 minute
    max: opts.max || 60, // 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = createRateLimiter;
