import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

// Carrega .env manualmente (sem dependência de dotenv)
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env ausente: segue com fallback
  }
}
loadEnv();

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://dev:02061994@127.0.0.1:5432/busca_la',
  max: 10,
});

export const q = (text, params) => pool.query(text, params);
