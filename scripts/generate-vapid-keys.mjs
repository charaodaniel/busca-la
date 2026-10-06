// Gera as chaves VAPID (Web Push) e grava em .env, caso ainda não existam.
// Uso: node scripts/generate-vapid-keys.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(ROOT, '.env');

if (!fs.existsSync(envPath)) {
  console.error('Arquivo .env não encontrado. Copie .env.example para .env primeiro.');
  process.exit(1);
}

let env = fs.readFileSync(envPath, 'utf8');

if (/^VAPID_PUBLIC_KEY=.+/m.test(env) && /^VAPID_PRIVATE_KEY=.+/m.test(env)) {
  console.log('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY já existem em .env — nada a fazer.');
  process.exit(0);
}

const keys = webpush.generateVAPIDKeys();

env = env
  .replace(/^VAPID_PUBLIC_KEY=.*\n?/gm, '')
  .replace(/^VAPID_PRIVATE_KEY=.*\n?/gm, '')
  .replace(/^VAPID_SUBJECT=.*\n?/gm, '');

if (!env.endsWith('\n')) env += '\n';
env += `VAPID_PUBLIC_KEY=${keys.publicKey}\n`;
env += `VAPID_PRIVATE_KEY=${keys.privateKey}\n`;
env += 'VAPID_SUBJECT=mailto:contato@buscala.app\n';

fs.writeFileSync(envPath, env);
console.log('Chaves VAPID geradas e gravadas em .env');
