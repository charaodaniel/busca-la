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
    // .env ausente: tratado abaixo
  }
}
loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    'ERRO: variável DATABASE_URL não definida.\n' +
      'Copie .env.example para .env e configure a conexão com o PostgreSQL.'
  );
  process.exit(1);
}

export const pool = new pg.Pool({ connectionString, max: 10 });

export const q = (text, params) => pool.query(text, params);
