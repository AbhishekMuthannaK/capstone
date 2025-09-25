import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const authRouter = (pool) => {
  const router = express.Router();

  const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    fullName: Joi.string().min(2).required(),
    role: Joi.string().valid('admin', 'faculty', 'hod', 'ministry').required(),
    department: Joi.string().allow('', null),
  });

  router.post('/register', async (req, res, next) => {
    try {
      const { email, password, fullName, role, department } = await registerSchema.validateAsync(req.body);
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = uuidv4();

      const result = await pool.query(
        `INSERT INTO app_user (user_id, email, password_hash, full_name, role, department)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING user_id, email, full_name, role, department, created_at`,
        [userId, email, passwordHash, fullName, role, department]
      );

      res.status(201).json({ user: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Email already registered' });
      }
      if (err.isJoi) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = await loginSchema.validateAsync(req.body);
      const { rows } = await pool.query(
        `SELECT user_id, email, password_hash, full_name, role FROM app_user WHERE email=$1`,
        [email]
      );
      const user = rows[0];
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

      const accessToken = jwt.sign(
        { sub: user.user_id, role: user.role, email: user.email, name: user.full_name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );
      const refreshToken = jwt.sign(
        { sub: user.user_id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
      );
      res.json({ accessToken, refreshToken });
    } catch (err) {
      if (err.isJoi) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ message: 'Missing refresh token' });
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
      if (payload.type !== 'refresh') throw new Error('Invalid token');
      const accessToken = jwt.sign(
        { sub: payload.sub },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );
      res.json({ accessToken });
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  });

  return router;
};

export default authRouter;


