# Busca Lá

Sistema de centralização de serviços de entrega, conectando **entregadores** a **comércios, empresas e pessoas** que precisam realizar entregas.

A proposta é criar uma plataforma simples onde entregadores podem se cadastrar, ficar disponíveis para receber solicitações e aceitar entregas conforme sua disponibilidade.

## 🎯 Objetivo

Centralizar a comunicação entre quem precisa realizar uma entrega e entregadores disponíveis.

O sistema não será limitado a restaurantes ou delivery de comida. Qualquer pessoa, empresa ou estabelecimento poderá solicitar uma entrega.

Exemplos:

* Restaurantes
* Lojas
* Mercados
* Farmácias
* Empresas
* Escritórios
* Pequenos comércios
* Pessoas físicas

## 🚚 Funcionamento

### Entregadores

O entregador poderá:

* Criar uma conta
* Cadastrar seus dados
* Informar sua modalidade de entrega
* Aguardar aprovação
* Ficar online ou offline
* Receber solicitações
* Aceitar ou recusar pedidos
* Visualizar suas entregas
* Acompanhar o status das entregas
* Consultar seu histórico

### Solicitantes

O solicitante poderá criar uma solicitação de entrega informando:

* Origem
* Destino
* Contato
* Descrição da entrega
* Observações
* Valor ou condições da entrega

### Formas de solicitar um entregador

**Chamar todos** — a solicitação é enviada para todos os entregadores disponíveis e o primeiro que aceitar fica responsável.

**Direcionado** — o solicitante escolhe um entregador específico e somente ele recebe a solicitação.

## 🛠️ Stack

### Backend

* Node.js (ES Modules) — testado no Node 24
* Express 4
* PostgreSQL (driver `pg`) — testado no PostgreSQL 18

### Frontend

* HTML5, CSS e JavaScript vanilla (sem frameworks)
* Leaflet — mapas de acompanhamento no dashboard
* PWA — manifest + service worker (instalável no celular)
* ViaCEP — preenchimento automático de endereço por CEP

### Gerenciador de pacotes

* npm (ou Bun — o repositório inclui `bun.lock`)

## ✅ Status atual

**Demo funcional.** Já implementado:

* Landing page (`/`) com apresentação do serviço
* Autenticação completa (login multi-identificador, cadastro, sessão, logout)
* Painel operacional (`/dashboard`) com visões de solicitante, entregador e admin
* Criação e acompanhamento de pedidos com histórico de eventos
* Avaliação mútua (solicitante ↔ entregador) com cálculo de média
* Dados persistidos em PostgreSQL (sobrevivem a reinícios)

## 🚀 Como rodar

### Pré-requisitos

* Node.js 18+
* PostgreSQL em execução

### Passos

```bash
# 1. Instalar dependências
npm install          # ou: bun install

# 2. Criar o banco de dados
createdb busca_la    # ou: psql -c 'CREATE DATABASE busca_la OWNER dev;'

# 3. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env e ajuste DATABASE_URL com seu usuário/senha

# 4. Aplicar o schema
psql "$DATABASE_URL" -f migrations/001_init.sql

# 5. (Opcional) Semear usuários e dados de demonstração
psql "$DATABASE_URL" -f migrations/seed.sql

# 6. Iniciar o servidor
npm run dev          # ou: node server.js
```

Acesse:

| Página | URL |
|---|---|
| Landing | `http://localhost:3000/` |
| Login | `http://localhost:3000/login` |
| Cadastro | `http://localhost:3000/cadastro` |
| Painel | `http://localhost:3000/dashboard` |

> Em rede local, use o IP do aparelho (ex.: `http://192.168.8.52:3000`). O servidor escuta em `0.0.0.0`.

## 👥 Usuários de teste

O seed (`migrations/seed.sql`) cria usuários de demonstração em todos os papéis:

| Nome | Papel | Login aceito por |
|---|---|---|
| Daniel Charão | admin | telefone `55996393353`, username `daniel`, e-mail |
| Maria Teste | solicitante | username `maria`, e-mail, telefone, CPF |
| João Entregador | entregador | username `joao`, e-mail, telefone, CPF |
| Ana Operadora | operador | username `ana`, e-mail, telefone, CPF |

A senha padrão dos usuários de teste está definida em `migrations/seed.sql`.

Também há 4 entregadores e 5 pedidos de demonstração (BL-1077 a BL-1082) em vários status.

## 🔐 Autenticação

* **Login multi-identificador**: o mesmo campo aceita nome de usuário, e-mail, telefone (só dígitos) ou CPF (com ou sem pontuação)
* **Cadastro**: nome + senha + pelo menos um identificador; tipo de conta (solicitante, entregador ou operador)
* **Senhas** armazenadas com scrypt + salt aleatório (formato `<salt-hex>:<hash-hex>`)
* **Sessões** em tabela `sessoes`, com cookie `HttpOnly` / `SameSite=Lax` válido por 30 dias
* **Banco de dados configurado** via variável `DATABASE_URL` no `.env` (não versionado)

Variáveis opcionais no `.env`:

```text
REQUIRE_AUTH=1   # exige login para acessar /dashboard (redireciona para /login)
```

Web Push (VAPID) — gere as chaves com `node scripts/generate-vapid-keys.mjs`:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contato@buscala.app
```

## 🔌 API REST

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Cria conta `{ nome, senha, username?, email?, telefone?, cpf?, papel? }` |
| `POST` | `/api/auth/login` | Autentica `{ identifier, senha }` e define cookie de sessão |
| `POST` | `/api/auth/logout` | Encerra a sessão atual |
| `GET` | `/api/auth/me` | Retorna o usuário logado (`{ user: null }` se anônimo) |

### Web Push (VAPID)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/push/public-key` | Retorna a chave pública VAPID (`{ publicKey, enabled }`) |
| `POST` | `/api/push/subscribe` | Registra uma inscrição `{ subscription }` (associa ao usuário logado) |
| `POST` | `/api/push/unsubscribe` | Remove a inscrição `{ endpoint }` |

### Pedidos e entregadores

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/state` | Estado completo: `{ drivers, orders, stats }` |
| `GET` | `/api/orders` | Lista todos os pedidos com eventos |
| `POST` | `/api/orders` | Cria pedido `{ originAddress, destinationAddress, description, dispatchMode, ... }` |
| `PATCH` | `/api/orders/:id/status` | Atualiza status `{ status, driverId? }` |
| `POST` | `/api/orders/:id/rate` | Avalia `{ role: 'solicitante'\|'entregador', stars, comment?, tags? }` |
| `GET` | `/api/drivers` | — (usar `/api/state`) |
| `POST` | `/api/drivers` | Cadastra entregador `{ name, vehicle, phone?, plate? }` |
| `PATCH` | `/api/drivers/:id` | Atualiza `{ isOnline?, approvalStatus? }` |

> Os IDs de entregador usados pela API têm o prefixo `drv-` (ex.: `drv-1`); os pedidos são identificados pelo código (ex.: `BL-1082`).

## 📦 Fluxo de status do pedido

```text
aguardando_aceite → aceito → em_coleta → em_entrega → concluido
                        └────────────────────────→ cancelado
```

Cada transição registra um evento com horário no histórico do pedido.

## 🗄️ Modelo de dados

```text
usuarios (id, nome, username*, email*, telefone*, cpf*, senha_hash, papel, ativo, criado_em)
   │      * únicos — qualquer um pode ser nulo, mas ao menos um é exigido
   ├── sessoes (token PK, usuario_id FK)
   └── entregadores (id, usuario_id FK?, nome, veiculo, placa, online, aprovacao, nota, entregas, ganhos_hoje)

pedidos (id, codigo*, codigo do pedido BL-XXXX, solicitante, endereços, preço,
         modo_despacho, entregador_id FK?, status, coordenadas, avaliações JSONB, criado_em)
   └── pedido_eventos (pedido_id FK, hora, descricao)
```

## 📁 Estrutura do projeto

```text
busca-la/
├── migrations/
│   ├── 001_init.sql        # schema (tabelas e índices)
│   └── seed.sql            # usuários e dados de demonstração
├── src/
│   ├── public/
│   │   ├── css/app.css
│   │   ├── images/logo.png
│   │   ├── js/app.js       # script da landing page (+ registro do SW)
│   │   ├── js/dashboard.js # lógica do painel
│   │   ├── manifest.webmanifest
│   │   └── sw.js           # service worker (PWA)
│   └── server/
│       ├── app.js          # rotas Express (API + páginas)
│       ├── auth.js         # scrypt, sessões e cookies
│       ├── db.js           # pool PostgreSQL (.env)
│       └── server.js       # bootstrap (porta/host)
├── tests/                  # (vazio — a implementar)
├── .env.example
├── dashboard.html          # painel operacional
├── index.html              # landing page
├── login.html              # tela de login
├── cadastro.html           # tela de cadastro
├── package.json
└── server.js               # entry point (importa src/server/server.js)
```

## 🗺️ Roadmap

* [x] Estrutura inicial do projeto
* [x] Configuração Node.js / Express
* [x] Configuração PostgreSQL (schema + seed)
* [x] Sistema de autenticação (login multi-identificador, cadastro, sessão)
* [x] Cadastro de entregadores
* [x] Cadastro de solicitantes
* [x] Aprovação de entregadores (painel admin)
* [x] Controle online/offline
* [x] Criação de pedidos
* [x] Chamar todos
* [x] Pedido direcionado
* [x] Aceite de pedidos
* [x] Fluxo de status da entrega
* [x] Histórico de eventos do pedido
* [x] Avaliação mútua com médias
* [x] Painel do solicitante / entregador / admin (demo)
* [x] PWA base (manifest + service worker)
* [x] Notificações em tempo real (Web Push/VAPID)
* [ ] Recuperação de senha
* [x] Testes automatizados (integração com `node:test` + PostgreSQL)
* [x] CI (GitHub Actions: testes + PostgreSQL)
* [ ] Anexar imagens/ícones do PWA na raiz servida
* [ ] Deploy público (há `scripts/deploy.sh` para o Termux)

## 🧪 Testes

Suíte de integração com o runner nativo do Node (`node:test`), contra um PostgreSQL real.

```bash
npm test
```

Os testes usam um banco dedicado (`busca_la_test`, derivado do `DATABASE_URL`) e aplicam as migrações automaticamente. Requer o PostgreSQL em execução e um `.env` configurado.

## 📄 Licença

A licença do projeto será definida posteriormente.
