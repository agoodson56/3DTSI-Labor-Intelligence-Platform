// Local development API server for machines where workerd is unavailable
// (e.g. Windows ARM64). Runs the real Hono app over a persistent SQLite file
// that emulates D1. Start with: npm run dev:local --workspace=worker
import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/index';
import { createTestDb } from '../test/d1shim';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.data');
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, 'lip-local.db');

const env = {
  DB: createTestDb(dbPath),
  FILES: {} as any, // R2 is only used by backup tooling, not by API routes
  JWT_SECRET: process.env.JWT_SECRET ?? 'local-dev-secret-do-not-use-in-production-0123456789abcdef',
  ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  SESSION_TIMEOUT_MINUTES: '480',
};

serve(
  {
    fetch: (req) => app.fetch(req, env),
    port: 8787,
  },
  (info) => {
    console.log(`3DTSI LIP local API listening on http://localhost:${info.port}`);
    console.log(`SQLite database: ${dbPath}`);
  },
);
