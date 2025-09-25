import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';

const chatRouter = (pool, io) => {
  const router = express.Router();
  router.use(authenticateJWT);

  router.get('/:meetingId', async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { rows } = await pool.query(
        `SELECT c.message_id, c.meeting_id, c.user_id, u.full_name, c.content, c.created_at
         FROM chat_message c JOIN app_user u ON u.user_id = c.user_id
         WHERE c.meeting_id=$1 ORDER BY c.created_at ASC`,
        [meetingId]
      );
      res.json({ messages: rows });
    } catch (err) { next(err); }
  });

  router.post('/:meetingId', async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { content } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO chat_message (meeting_id, user_id, content) VALUES ($1,$2,$3) RETURNING *`,
        [meetingId, req.user.sub, content]
      );
      const message = rows[0];
      io.to(meetingId).emit('chat:new', message);
      res.status(201).json({ message });
    } catch (err) { next(err); }
  });

  return router;
};

export default chatRouter;


