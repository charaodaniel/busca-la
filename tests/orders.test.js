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

const ORDER = {
  requesterName: 'Cliente Teste',
  requesterPhone: '(11) 90000-0000',
  originAddress: 'Rua A, 10 - Centro',
  destinationAddress: 'Rua B, 20 - Bairro',
  distanceKm: 4.2,
  price: 15,
  description: 'Pacote de teste',
  notes: 'observação',
  dispatchMode: 'chamar_todos',
};

test('cria pedido com status inicial e histórico de eventos', async () => {
  const r = await api.post('/api/orders', ORDER);
  assert.equal(r.status, 201);
  assert.equal(r.data.order.status, 'aguardando_aceite');
  assert.match(r.data.order.id, /^BL-\d+$/);
  assert.equal(r.data.order.dispatchMode, 'chamar_todos');
  assert.equal(r.data.order.events.length, 2);
  assert.equal(r.data.order.price, 15);
});

test('criação exige origem, destino e descrição', async () => {
  const r = await api.post('/api/orders', {
    requesterName: 'X',
    originAddress: 'só origem',
  });
  assert.equal(r.status, 400);
});

test('state agrega drivers, orders e stats', async () => {
  await api.post('/api/drivers', { name: 'Novo Entregador', vehicle: 'Moto' });
  await api.post('/api/orders', ORDER);

  const r = await api.get('/api/state');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data.drivers));
  assert.ok(Array.isArray(r.data.orders));
  assert.equal(r.data.stats.totalDrivers, 1);
  assert.equal(r.data.stats.activeOrders, 1);
  assert.equal(r.data.orders.length, 1);
});

test('pedido direcionado atribui entregador e registra no histórico', async () => {
  const d = await api.post('/api/drivers', { name: 'Dirigido', vehicle: 'Carro', plate: 'XYZ1234' });
  const driverId = d.data.driver.id;
  assert.match(driverId, /^drv-\d+$/);

  const r = await api.post('/api/orders', {
    ...ORDER,
    dispatchMode: 'direcionado',
    assignedDriverId: driverId,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.assignedDriverId, driverId);
  assert.equal(r.data.order.assignedDriverName, 'Dirigido');
  assert.ok(r.data.order.events.some((e) => /direcionado exclusivamente/i.test(e.description)));
});

test('fluxo de status registra eventos e credita o entregador no final', async () => {
  const d = await api.post('/api/drivers', { name: 'Fluxo', vehicle: 'Moto' });
  const driverId = d.data.driver.id;

  const created = await api.post('/api/orders', ORDER);
  const orderId = created.data.order.id;

  const steps = [
    ['aceito', driverId],
    ['em_coleta', undefined],
    ['em_entrega', undefined],
    ['concluido', undefined],
  ];

  let last;
  for (const [status, drv] of steps) {
    last = await api.patch(
      `/api/orders/${orderId}/status`,
      drv ? { status, driverId: drv } : { status }
    );
    assert.equal(last.status, 200, `transição para ${status}`);
    assert.equal(last.data.order.status, status);
  }

  // 2 eventos iniciais + 4 transições
  assert.equal(last.data.order.events.length, 6);
  assert.equal(last.data.stats.completedOrders, 1);

  const st = await api.get('/api/state');
  const driver = st.data.drivers.find((x) => x.id === driverId);
  assert.equal(driver.deliveriesCount, 1);
  assert.equal(driver.todayEarnings, 15);
});

test('status inválido é rejeitado', async () => {
  const created = await api.post('/api/orders', ORDER);
  const r = await api.patch(`/api/orders/${created.data.order.id}/status`, { status: 'voando' });
  assert.equal(r.status, 400);
});

test('status em pedido inexistente retorna 404', async () => {
  const r = await api.patch('/api/orders/BL-0000/status', { status: 'aceito' });
  assert.equal(r.status, 404);
});

test('avaliação do solicitante grava nota e recalcula a média do entregador', async () => {
  const d = await api.post('/api/drivers', { name: 'Avaliado', vehicle: 'Moto' });
  const driverId = d.data.driver.id;
  const created = await api.post('/api/orders', ORDER);
  const orderId = created.data.order.id;
  await api.patch(`/api/orders/${orderId}/status`, { status: 'aceito', driverId });

  const r = await api.post(`/api/orders/${orderId}/rate`, {
    role: 'solicitante',
    stars: 5,
    comment: 'Ótimo',
    tags: ['Rápido ⚡'],
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.order.userRating.stars, 5);

  const st = await api.get('/api/state');
  const driver = st.data.drivers.find((x) => x.id === driverId);
  assert.ok(driver.rating >= 4.5, `média recalculada: ${driver.rating}`);
});

test('avaliação do entregador é gravada e role inválido é rejeitado', async () => {
  const created = await api.post('/api/orders', ORDER);
  const orderId = created.data.order.id;

  const ok = await api.post(`/api/orders/${orderId}/rate`, { role: 'entregador', stars: 4 });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.order.driverRating.stars, 4);

  const bad = await api.post(`/api/orders/${orderId}/rate`, { role: 'cliente', stars: 4 });
  assert.equal(bad.status, 400);
});

test('cadastro de entregador exige nome e veículo', async () => {
  const r = await api.post('/api/drivers', { name: 'Sem Veículo' });
  assert.equal(r.status, 400);
});

test('PATCH driver alterna online/aprovação e retorna 404 se não existir', async () => {
  const d = await api.post('/api/drivers', { name: 'Toggle', vehicle: 'Moto' });
  const id = d.data.driver.id;

  const on = await api.patch(`/api/drivers/${id}`, { isOnline: true, approvalStatus: 'aprovado' });
  assert.equal(on.status, 200);
  assert.equal(on.data.driver.isOnline, true);
  assert.equal(on.data.driver.approvalStatus, 'aprovado');

  const missing = await api.patch('/api/drivers/drv-9999', { isOnline: true });
  assert.equal(missing.status, 404);
});
