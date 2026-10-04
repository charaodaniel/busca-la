import crypto from 'crypto';
import { q } from './db.js';

export const COOKIES = { SESSION: 'buscala_session' };

// Hash de senha com scrypt (nativo do Node, sem dependências)
// Formato armazenado: "<salt-hex>:<hash-hex>" (salt decodificado como bytes)
export function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return salt.toString('hex') + ':' + hash;
}

export function verificarSenha(senha, armazenado) {
  const [salt, hash] = String(armazenado || '').split(':');
  if (!salt || !hash) return false;
  // salt armazenado em hex (gerado por seed), decodifica para bytes
  const calc = crypto.scryptSync(String(senha), Buffer.from(salt, 'hex'), 64);
  const ref = Buffer.from(hash, 'hex');
  return calc.length === ref.length && crypto.timingSafeEqual(calc, ref);
}

export function parseCookies(header) {
  const out = {};
  String(header || '')
    .split(';')
    .forEach((p) => {
      const i = p.indexOf('=');
      if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
  return out;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    COOKIES.SESSION + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', COOKIES.SESSION + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

export async function criarSessao(usuarioId) {
  const token = crypto.randomUUID();
  await q('INSERT INTO sessoes (token, usuario_id) VALUES ($1, $2)', [token, usuarioId]);
  return token;
}

export async function buscarSessao(token) {
  if (!token) return null;
  const r = await q(
    `SELECT u.* FROM sessoes s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token = $1 AND u.ativo`,
    [token]
  );
  return r.rows[0] || null;
}

export async function deletarSessao(token) {
  if (!token) return;
  await q('DELETE FROM sessoes WHERE token = $1', [token]);
}

export function usuarioSeguro(u) {
  if (!u) return null;
  return {
    id: u.id,
    nome: u.nome,
    username: u.username,
    email: u.email,
    telefone: u.telefone,
    cpf: u.cpf,
    papel: u.papel,
    criadoEm: u.criado_em ? new Date(u.criado_em).toISOString() : null,
  };
}
