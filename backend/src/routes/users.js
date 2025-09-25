import express from 'express';
import Joi from 'joi';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const userRouter = (pool) => {
  const router = express.Router();

  router.use(authenticateJWT);

  router.get('/', authorizeRoles('admin', 'hod', 'ministry'), async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT user_id, email, full_name, role, department, created_at FROM app_user ORDER BY created_at DESC`
      );
      res.json({ users: rows });
    } catch (err) { next(err); }
  });

  const updateSchema = Joi.object({
    fullName: Joi.string(),
    department: Joi.string().allow('', null),
    role: Joi.string().valid('admin', 'faculty', 'hod', 'ministry'),
  });

  router.put('/:userId', authorizeRoles('admin', 'hod', 'ministry'), async (req, res, next) => {
    try {
      const { userId } = req.params;
      const payload = await updateSchema.validateAsync(req.body);
      const { rows } = await pool.query(
        `UPDATE app_user SET full_name=COALESCE($1, full_name), department=COALESCE($2, department), role=COALESCE($3, role)
         WHERE user_id=$4 RETURNING user_id, email, full_name, role, department`,
        [payload.fullName ?? null, payload.department ?? null, payload.role ?? null, userId]
      );
      if (!rows[0]) return res.status(404).json({ message: 'User not found' });
      res.json({ user: rows[0] });
    } catch (err) { if (err.isJoi) return res.status(400).json({ message: err.message }); next(err); }
  });

  return router;
};

export default userRouter;


