import rateLimit from 'express-rate-limit';

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute
  message: { error: 'Too many AI requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
