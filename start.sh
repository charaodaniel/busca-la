#!/data/data/com.termux/files/usr/bin/bash
# start.sh - Inicia o Busca Lá com o banco no Termux
#
# Arquitetura suportada:
#   A) Tudo no Termux         : bash start.sh                     (frontend localhost:3000)
#   B) Frontend no seu PC     : bash start.sh --lan               (backend no Termux + frontend no PC)
#
# Regras:
#   * O PostgreSQL SEMPRE fica no Termux (serviço 'postgres'), acessível em 127.0.0.1:5432.
#   * O frontend (HTML/CSS/JS) pode rodar na sua máquina (host), conectando
#     no banco do Termux via URL DATABASE_URL.
#
# Uso:
#   1) Tudo no Termux:
#        cd ~/Dev/busca-la && bash start.sh
#   2) Frontend no PC, banco no Termux:
#        cd ~/Dev/busca-la && bash start.sh --lan
#
# Depois do front-end no host, o .env do host deve ficar assim:
#   PORT=3333
#   DATABASE_URL=postgresql://dev:02061994@<IP-do-Termux>:5432/busca_la

set -euo pipefail

APP_DIR="$HOME/Dev/busca-la"
LOG_DIR="$HOME"
LISTEN_HOST="127.0.0.1"
APP_PORT="3000"

# ---- 0) Opções --------------------------------------------------------------
# Precisa vir ANTES dos exports para que PORT/HOST reflitam a opção escolhida.
while [[ "${1:-}" == --lan ]]; do
  shift
  APP_PORT="3333"            # porta exposta para a máquina do usuário
  LISTEN_HOST="0.0.0.0"      # escuta em todas as interfaces da rede
done

# Variaveis de ambiente que o servidor (server.js) lê:
#   PORT  -> porta do backend (3000 ou 3333)
#   HOST  -> onde o backend escuta (127.0.0.1 ou 0.0.0.0)
export PORT="$APP_PORT"
export HOST="$LISTEN_HOST"

# ---- 1) Banco de dados no Termux (sempre) -----------------------------------
echo "[1/4] Banco de dados no Termux..."
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "  PostgreSQL não está rodando. Iniciando..."
  if command -v servus >/dev/null 2>&1; then
    servus postgres 2>/dev/null || true
  elif command -v su >/dev/null 2>&1; then
    su postgres -c 'service postgresql start' 2>/dev/null || true
  fi
  sleep 2
fi

if ! PGPASSWORD=02061994 psql -h 127.0.0.1 -U dev -d busca_la -c 'SELECT 1;' >/dev/null 2>&1; then
  echo "  ERRO: não conectou no banco busca_la como dev."
  echo "  Tente: psql -h 127.0.0.1 -U dev -d busca_la -W"
  exit 1
fi
echo "  Banco OK (dev @ 127.0.0.1:5432 / busca_la)"

# ---- 2) Backend no Termux --------------------------------------------------->
echo "[2/4] Iniciando backend no Termux..."
cd "$APP_DIR" || exit 1
npm install --no-audit --no-fund >> "$LOG_DIR/buscala-dev.log" 2>&1 || exit 1
# setsid desacopla o processo da sessão (sobrevive ao fechamento do terminal/SSH)
setsid -f npm run dev >> "$LOG_DIR/buscala-dev.log" 2>&1 < /dev/null
echo "  Backend iniciado (setsid) na porta $APP_PORT"
sleep 3

if curl -s -m 2 "http://127.0.0.1:${APP_PORT}/api/state" >/dev/null 2>&1; then
  echo "  Backend OK: http://127.0.0.1:${APP_PORT}/api/state"
else
  echo "  Aviso: backend não respondeu. Veja $LOG_DIR/buscala-dev.log"
fi

# ---- 3) Frontend no host (sua máquina) -------------------------------------->
echo "[3/4] Frontend no host (sua máquina):"
echo "  1. cd ~/Dev/busca-la"
echo "  2. cp .env.example .env"
echo "  3. Edite .env e defina:"
echo "       PORT=3333"
echo "       DATABASE_URL=postgresql://dev:02061994@<IP-do-Termux>:5432/busca_la"
echo "  4. npm install && npm run dev"
echo "  5. Acesse: http://<IP-do-Termux>:$APP_PORT"

echo "[4/4] Pronto."
echo "  Backend no Termux: http://127.0.0.1:3000"
echo "  Acesso no seu PC: http://<IP-do-Termux>:$APP_PORT"
