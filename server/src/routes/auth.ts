import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { createUser, getUserByEmail } from '../db/repositories/user-repo.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const TOKEN_EXPIRY = '7d';

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  try {
    const existing = await getUserByEmail(email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    await createUser({ id: userId, email: email.toLowerCase(), passwordHash, createdAt: new Date().toISOString() });
    const token = jwt.sign({ userId, email: email.toLowerCase() }, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });
    res.json({ token, email: email.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  try {
    const user = await getUserByEmail(email.toLowerCase());
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });
    res.json({ token, email: user.email });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ userId: req.user!.userId, email: req.user!.email });
});

export default router;
