#!/data/data/com.termux/files/usr/bin/bash
# deploy.sh - Atualiza e reinicia o Busca Lá no Termux.
#
# Uso:  cd ~/Dev/busca-la && bash scripts/deploy.sh
#
# Passos: git pull -> npm install -> migrações -> reinício do servidor.
# Observação: requer que as alterações estejam commitadas/pushadas no remoto,
# pois usa `git pull --ff-only`.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/Dev/busca-la}"
LOG_FILE="${LOG_FILE:-$HOME/buscala-dev.log}"
HEALTH_PORT="${PORT:-3000}"

cd "$APP_DIR"

echo "[deploy] Atualizando código (git pull)..."
git pull --ff-only

echo "[deploy] Instalando dependências..."
npm install --no-audit --no-fund

echo "[deploy] Aplicando migrações..."
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -n1 | cut -d= -f2-)"
for f in migrations/*.sql; do
  base="$(basename "$f")"
  [ "$base" = "seed.sql" ] && continue
  psql "$DATABASE_URL" -f "$f" >/dev/null
done

echo "[deploy] Reiniciando servidor..."
pkill -f "node server.js" 2>/dev/null || true
sleep 1
setsid -f node server.js >> "$LOG_FILE" 2>&1 < /dev/null
sleep 3

if curl -s -m 3 "http://127.0.0.1:${HEALTH_PORT}/api/state" >/dev/null 2>&1; then
  echo "[deploy] OK - servidor respondendo em http://127.0.0.1:${HEALTH_PORT}"
else
  echo "[deploy] FALHOU - servidor não respondeu. Veja $LOG_FILE"
  exit 1
fi
