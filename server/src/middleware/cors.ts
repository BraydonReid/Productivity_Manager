import cors from 'cors';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests from Chrome extensions and localhost
    if (
      !origin ||
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
