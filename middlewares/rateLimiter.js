const rateLimit = require('express-rate-limit');
const { RateLimitRedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

/**
 * Creates a rate limiter middleware
 * If Redis is available, uses Redis store, otherwise falls back to memory store
 */
async function createRateLimiter() {
  const redisClient = await getRedisClient();
  
  const limiterOptions = {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      status: 429,
      message: 'Too many requests from this IP, please try again later.'
    },
    skipSuccessfulRequests: false, // Count successful requests against the rate limit
  };
  
  // If Redis client exists, use Redis store
  if (redisClient) {
    limiterOptions.store = new RateLimitRedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'rl:chirper:'
    });
    console.log('Using Redis store for rate limiting');
  } else {
    console.log('Using memory store for rate limiting');
  }
  
  return rateLimit(limiterOptions);
}

// Export a basic rate limiter that will be replaced once Redis is initialized
let apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again later.'
});

// Initialize the rate limiter asynchronously
(async () => {
  try {
    apiLimiter = await createRateLimiter();
    console.log('Rate limiter initialized');
  } catch (error) {
    console.error('Failed to initialize rate limiter with Redis:', error);
    console.log('Using memory-based rate limiter as fallback');
  }
})();

module.exports = (req, res, next) => apiLimiter(req, res, next);
