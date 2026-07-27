// Optional PostgreSQL pool — gracefully absent when DATABASE_URL is not configured.
// Session logging is non-critical; callers must handle null return value.
//
// On Replit: DATABASE_URL is auto-injected by the Replit DB provisioner.
// On Vercel: set DATABASE_URL in Project Settings → Environment Variables,
//            pointing to a publicly accessible PostgreSQL instance (e.g. Neon, Supabase).

import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _tableReady = false;

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function ensureSessionTable(): Promise<void> {
  const pool = getPool();
  if (!pool || _tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS speakup_sessions (
      id                 SERIAL PRIMARY KEY,
      device_id          TEXT NOT NULL DEFAULT 'anonymous',
      estimated_level    TEXT,
      error_tags         TEXT[],
      scenario           TEXT,
      interface_language TEXT,
      feedback_language  TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='speakup_sessions' AND column_name='interface_language') THEN
        ALTER TABLE speakup_sessions ADD COLUMN interface_language TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='speakup_sessions' AND column_name='feedback_language') THEN
        ALTER TABLE speakup_sessions ADD COLUMN feedback_language TEXT;
      END IF;
    END $$;
  `);
  _tableReady = true;
}
