import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJWT } from '../middleware/auth.js';

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const upload = multer({ storage });

const filesRouter = (pool) => {
  const router = express.Router();
  router.use(authenticateJWT);

  router.post('/:meetingId', upload.single('file'), async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const file = req.file;
      const { rows } = await pool.query(
        `INSERT INTO shared_file (meeting_id, uploader_id, file_name, file_path, mime_type, size_bytes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [meetingId, req.user.sub, file.originalname, file.filename, file.mimetype, file.size]
      );
      res.status(201).json({ file: rows[0] });
    } catch (err) { next(err); }
  });

  router.get('/:meetingId', async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { rows } = await pool.query(
        `SELECT * FROM shared_file WHERE meeting_id=$1 ORDER BY created_at DESC`,
        [meetingId]
      );
      res.json({ files: rows });
    } catch (err) { next(err); }
  });

  router.get('/download/:fileId', async (req, res, next) => {
    try {
      const { fileId } = req.params;
      const { rows } = await pool.query(`SELECT * FROM shared_file WHERE file_id=$1`, [fileId]);
      const file = rows[0];
      if (!file) return res.status(404).json({ message: 'Not found' });
      const fullPath = path.join(uploadDir, file.file_path);
      res.download(fullPath, file.file_name);
    } catch (err) { next(err); }
  });

  return router;
};

export default filesRouter;


