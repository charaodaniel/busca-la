// Helpers para testes de integração do Busca Lá.
// Rodam contra um PostgreSQL real, em um banco dedicado de teste
// (por padrão, o mesmo nome do banco de desenvolvimento + sufixo "_test").
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readDotEnv() {
  const out = {};
  try {
    const raw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && out[m[1]] === undefined) {
        out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // sem .env
  }
  return out;
}

const env = readDotEnv();
const baseUrl = process.env.DATABASE_URL || env.DATABASE_URL;
if (!baseUrl) {
  throw new Error(
    'DATABASE_URL não definida (variável de ambiente ou .env). Configure antes de rodar os testes.'
  );
}

export const TEST_DB_NAME = process.env.TEST_DB_NAME || `${new URL(baseUrl).pathname.slice(1)}_test`;

const testUrl = new URL(baseUrl);
testUrl.pathname = '/' + TEST_DB_NAME;
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || testUrl.toString();

const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
export const ADMIN_DATABASE_URL = adminUrl.toString();

// Cria o banco de teste se ainda não existir.
export async function ensureTestDatabase() {
  const client = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
    if (r.rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await client.end();
  }
}

// Aplica todas as migrações de schema (migrations/*.sql, exceto o seed) no banco de teste.
export async function migrate(pool) {
  const dir = path.join(ROOT, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && f !== 'seed.sql')
    .sort();
  for (const f of files) {
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
}

// Limpa os dados entre testes, reiniciando as sequências.
export async function resetData(pool) {
  await pool.query(
    'TRUNCATE push_subscriptions, pedido_eventos, pedidos, entregadores, sessoes, usuarios RESTART IDENTITY CASCADE'
  );
}

// Cliente HTTP com cookie jar, para exercitar as rotas com sessão.
export function makeClient(baseUrl) {
  const jar = new Map();

  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  function storeCookies(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of raw) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (i > -1) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  async function request(method, p, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const cookie = cookieHeader();
    if (cookie) headers['Cookie'] = cookie;

    const res = await fetch(baseUrl + p, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    storeCookies(res);

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    patch: (p, b) => request('PATCH', p, b),
    jar,
  };
}
