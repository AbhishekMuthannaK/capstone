import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const recordingsRouter = (pool) => {
  const router = express.Router();
  router.use(authenticateJWT);

  router.post('/:meetingId', authorizeRoles('admin','faculty','hod','ministry'), async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { storageUrl, durationSeconds, transcript } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO meeting_recording (meeting_id, storage_url, duration_seconds, transcript)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [meetingId, storageUrl, durationSeconds || null, transcript || null]
      );
      res.status(201).json({ recording: rows[0] });
    } catch (err) { next(err); }
  });

  router.get('/:meetingId', async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { rows } = await pool.query(
        `SELECT * FROM meeting_recording WHERE meeting_id=$1 ORDER BY created_at DESC`,
        [meetingId]
      );
      res.json({ recordings: rows });
    } catch (err) { next(err); }
  });

  return router;
};

export default recordingsRouter;


