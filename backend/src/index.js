import 'dotenv/config';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { createDatabasePool } from './config/db.js';
import { registerSocketHandlers } from './realtime/socket.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/users.js';
import meetingRouter from './routes/meetings.js';
import chatRouter from './routes/chat.js';
import filesRouter from './routes/files.js';
import recordingsRouter from './routes/recordings.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
});

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database
const pool = createDatabasePool();
app.set('db', pool);
app.set('io', io);

// Health
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: result.rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'DB connection failed' });
  }
});

// Routes
app.use('/api/auth', authRouter(pool));
app.use('/api/users', userRouter(pool));
app.use('/api/meetings', meetingRouter(pool, io));
app.use('/api/chat', chatRouter(pool, io));
app.use('/api/files', filesRouter(pool));
app.use('/api/recordings', recordingsRouter(pool));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Avoid leaking internal errors
  console.error(err);
  res.status(err.status || 500).json({ message: err.publicMessage || 'Internal Server Error' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`AICTE Meeting Portal backend running on port ${PORT}`);
});


