// Web Push real (VAPID) para o Busca Lá.
// Requer as variáveis VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no .env
// (gere com: node scripts/generate-vapid-keys.mjs).
import webpush from 'web-push';
import { q } from './db.js';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@buscala.app';

export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

export function getPublicKey() {
  return PUBLIC_KEY;
}

// Salva (ou atualiza) uma inscrição de push, associando ao usuário logado quando houver.
export async function saveSubscription(sub, usuarioId = null) {
  const endpoint = sub && sub.endpoint;
  const keys = (sub && sub.keys) || {};
  if (!endpoint || !keys.p256dh || !keys.auth) return null;

  const r = await q(
    `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE
       SET usuario_id = EXCLUDED.usuario_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth
     RETURNING id`,
    [usuarioId, endpoint, keys.p256dh, keys.auth]
  );
  return r.rows[0].id;
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await q('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

async function sendTo(rows, payload) {
  let sent = 0;
  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sent += 1;
    } catch (err) {
      // 404/410 => inscrição expirada: remove para não acumular lixo
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await removeSubscription(row.endpoint).catch(() => {});
      } else {
        console.warn('push send falhou:', err && err.statusCode, err && err.message);
      }
    }
  }
  return sent;
}

// Notifica sobre um novo pedido: para um entregador específico (direcionado)
// ou para todas as inscrições (chamar todos).
export async function notifyNewOrder({ order, targetUsuarioId = null }) {
  if (!pushConfigured) return 0;

  const payload = {
    title: `🚨 Nova entrega ${order.id}`,
    body: `${order.originAddress} → ${order.destinationAddress} · R$ ${Number(
      order.price || 0
    ).toFixed(2).replace('.', ',')}`,
    url: '/dashboard?role=entregador',
    id: `order-${order.id}`,
  };

  const rows = targetUsuarioId
    ? (await q('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = $1', [
        targetUsuarioId,
      ])).rows
    : (await q('SELECT endpoint, p256dh, auth FROM push_subscriptions')).rows;

  return sendTo(rows, payload);
}
