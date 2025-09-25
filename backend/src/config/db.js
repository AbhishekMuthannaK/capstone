import pg from 'pg';

const { Pool } = pg;

export function createDatabasePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('DATABASE_URL not set. Using default local connection.');
  }
  const pool = new Pool({
    connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/aicte_meet',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PG pool error', err);
  });

  return pool;
}


