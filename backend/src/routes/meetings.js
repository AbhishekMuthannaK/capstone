import express from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const meetingRouter = (pool, io) => {
  const router = express.Router();
  router.use(authenticateJWT);

  const meetingSchema = Joi.object({
    title: Joi.string().min(3).required(),
    description: Joi.string().allow('', null),
    scheduledStart: Joi.date().iso().required(),
    scheduledEnd: Joi.date().iso().required(),
    visibility: Joi.string().valid('private', 'department', 'organization').default('private'),
    participants: Joi.array().items(Joi.string().uuid()).default([]),
  });

  router.post('/', authorizeRoles('admin', 'faculty', 'hod', 'ministry'), async (req, res, next) => {
    try {
      const payload = await meetingSchema.validateAsync(req.body);
      const meetingId = uuidv4();
      const meetingCode = uuidv4();

      await pool.query('BEGIN');
      const { rows: meetingRows } = await pool.query(
        `INSERT INTO meeting (meeting_id, meeting_code, title, description, scheduled_start, scheduled_end, visibility, organizer_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [meetingId, meetingCode, payload.title, payload.description, payload.scheduledStart, payload.scheduledEnd, payload.visibility, req.user.sub]
      );
      for (const userId of new Set([req.user.sub, ...payload.participants])) {
        await pool.query(
          `INSERT INTO meeting_participant (meeting_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [meetingId, userId, userId === req.user.sub ? 'host' : 'attendee']
        );
      }
      await pool.query('COMMIT');

      res.status(201).json({ meeting: meetingRows[0] });
    } catch (err) {
      await pool.query('ROLLBACK');
      if (err.isJoi) return res.status(400).json({ message: err.message });
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT m.*, u.full_name as organizer_name FROM meeting m
         JOIN app_user u ON u.user_id = m.organizer_id
         WHERE m.organizer_id=$1 OR m.meeting_id IN (
           SELECT meeting_id FROM meeting_participant WHERE user_id=$1
         )
         ORDER BY m.scheduled_start DESC`,
        [req.user.sub]
      );
      res.json({ meetings: rows });
    } catch (err) { next(err); }
  });

  router.get('/:meetingId', async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { rows } = await pool.query(
        `SELECT * FROM meeting WHERE meeting_id=$1`,
        [meetingId]
      );
      const meeting = rows[0];
      if (!meeting) return res.status(404).json({ message: 'Not found' });
      res.json({ meeting });
    } catch (err) { next(err); }
  });

  router.post('/:meetingId/participants', authorizeRoles('admin', 'faculty', 'hod', 'ministry'), async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { userId, role } = req.body;
      await pool.query(
        `INSERT INTO meeting_participant (meeting_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [meetingId, userId, role || 'attendee']
      );
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // Basic notification trigger (to be implemented by worker)
  router.post('/:meetingId/notify', authorizeRoles('admin','faculty','hod','ministry'), async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      io.to(meetingId).emit('meeting:notify', { meetingId, message: 'Reminder' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};

export default meetingRouter;


