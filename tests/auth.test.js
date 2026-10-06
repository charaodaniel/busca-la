import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_DATABASE_URL,
  ensureTestDatabase,
  migrate,
  resetData,
  makeClient,
} from './helpers.js';

process.env.DATABASE_URL = TEST_DATABASE_URL;
await ensureTestDatabase();

const { default: app } = await import('../src/server/app.js');
const { pool } = await import('../src/server/db.js');

await migrate(pool);

let server;
let baseUrl;
let api;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

beforeEach(async () => {
  await resetData(pool);
  api = makeClient(baseUrl);
});

const VALID = {
  nome: 'Fulano de Tal',
  username: 'fulano',
  email: 'fulano@teste.com',
  telefone: '(55) 99999-0000',
  cpf: '12345678901',
  senha: 'segredo123',
  papel: 'solicitante',
};

test('registro cria conta, define cookie e retorna usuário seguro', async () => {
  const r = await api.post('/api/auth/register', VALID);
  assert.equal(r.status, 201);
  assert.equal(r.data.success, true);
  assert.equal(r.data.user.username, 'fulano');
  assert.equal(r.data.user.email, 'fulano@teste.com');
  assert.equal(r.data.user.telefone, '55999990000');
  assert.equal(r.data.user.cpf, '12345678901');
  assert.equal(r.data.user.senha_hash, undefined);
  assert.ok(api.jar.has('buscala_session'), 'deve definir o cookie de sessão');
});

test('registro exige ao menos um identificador', async () => {
  const r = await api.post('/api/auth/register', { nome: 'Sem Documento', senha: 'segredo123' });
  assert.equal(r.status, 400);
});

test('registro rejeita senha curta', async () => {
  const r = await api.post('/api/auth/register', { nome: 'Curto', username: 'curto', senha: '123' });
  assert.equal(r.status, 400);
});

test('registro rejeita CPF com tamanho inválido', async () => {
  const r = await api.post('/api/auth/register', {
    nome: 'Cpf Ruim',
    username: 'cpfruim',
    cpf: '123',
    senha: 'segredo123',
  });
  assert.equal(r.status, 400);
});

test('registro rejeita identificador duplicado', async () => {
  await api.post('/api/auth/register', VALID);
  const dup = await api.post('/api/auth/register', {
    ...VALID,
    email: 'outro@teste.com',
    telefone: null,
    cpf: null,
  });
  assert.equal(dup.status, 409);
});

test('login aceita username, email, telefone e CPF', async () => {
  await api.post('/api/auth/register', VALID);
  for (const identifier of ['fulano', 'fulano@teste.com', '55999990000', '12345678901']) {
    const c = makeClient(baseUrl);
    const r = await c.post('/api/auth/login', { identifier, senha: 'segredo123' });
    assert.equal(r.status, 200, `login por ${identifier}`);
    assert.equal(r.data.user.username, 'fulano');
  }
});

test('login rejeita senha incorreta', async () => {
  await api.post('/api/auth/register', VALID);
  const c = makeClient(baseUrl);
  const r = await c.post('/api/auth/login', { identifier: 'fulano', senha: 'errada' });
  assert.equal(r.status, 401);
});

test('login rejeita campos ausentes', async () => {
  const r = await api.post('/api/auth/login', { identifier: 'fulano' });
  assert.equal(r.status, 400);
});

test('me retorna null quando anônimo e o usuário quando autenticado', async () => {
  const anon = makeClient(baseUrl);
  const anonMe = await anon.get('/api/auth/me');
  assert.equal(anonMe.data.user, null);

  const c = makeClient(baseUrl);
  await c.post('/api/auth/register', VALID);
  const me = await c.get('/api/auth/me');
  assert.equal(me.data.user.username, 'fulano');
});

test('logout encerra a sessão', async () => {
  const c = makeClient(baseUrl);
  await c.post('/api/auth/register', VALID);
  const out = await c.post('/api/auth/logout', {});
  assert.equal(out.status, 200);

  const me = await c.get('/api/auth/me');
  assert.equal(me.data.user, null);
});
