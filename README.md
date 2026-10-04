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
* Outros tipos de estabelecimentos ou serviços

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

## 📢 Formas de solicitar um entregador

O sistema terá inicialmente dois modos.

### Chamar todos

A solicitação é enviada para os entregadores disponíveis.

O primeiro entregador que aceitar fica responsável pela entrega.

```text
Novo pedido
     ↓
Chamar todos
     ↓
Entregadores recebem notificação
     ↓
Um entregador aceita
     ↓
Pedido atribuído
```

Após um entregador aceitar, os demais não poderão aceitar aquele pedido.

### Direcionar para um entregador

O solicitante poderá escolher um entregador específico.

Somente o entregador selecionado receberá a solicitação.

```text
Novo pedido
     ↓
Escolher entregador
     ↓
Solicitação enviada
     ↓
Entregador aceita
     ↓
Pedido atribuído
```

## 📦 Status da entrega

O fluxo básico será:

```text
RASCUNHO
   ↓
AGUARDANDO ACEITE
   ↓
ACEITO
   ↓
EM COLETA
   ↓
EM ENTREGA
   ↓
CONCLUÍDO
```

Também poderão existir estados de:

* Recusado
* Cancelado
* Expirado

## 👥 Tipos de usuários

### Entregador

Responsável por aceitar e realizar as entregas.

### Solicitante

Pessoa ou organização que solicita uma entrega.

### Operador

Responsável pelo acompanhamento e gerenciamento operacional.

### Administrador

Responsável pela administração geral da plataforma.

## 🛠️ Stack

### Frontend

* HTML5
* CSS
* JavaScript
* Tailwind CSS
* HTMX
* PWA

### Backend

* Node.js

### Banco de dados

* PostgreSQL

A aplicação será desenvolvida priorizando HTML e renderização server-side com HTMX, utilizando JavaScript apenas quando houver necessidade de comportamento no cliente.

## 📱 PWA

O sistema será desenvolvido como Progressive Web App.

Objetivos:

* Instalação no celular
* Interface responsiva
* Funcionamento em dispositivos móveis
* Service Worker
* Manifest
* Notificações
* Experiência semelhante a aplicativo

## 🔔 Notificações

As notificações serão importantes principalmente para os entregadores.

Quando uma nova solicitação estiver disponível, o entregador poderá receber uma notificação informando que existe uma nova entrega.

A implementação definitiva de comunicação em tempo real será definida durante o desenvolvimento.

## 🗄️ Banco de dados

O sistema utilizará PostgreSQL.

Principais entidades previstas:

```text
Usuários
   │
   ├── Entregadores
   │      └── Veículos
   │
   └── Solicitantes
          └── Estabelecimentos

Pedidos
   │
   ├── Origem
   ├── Destino
   ├── Solicitante
   └── Entregador

Eventos do pedido
```

O histórico de eventos será mantido para permitir auditoria e acompanhamento da operação.

Exemplo:

```text
10:31  Pedido criado
10:31  Chamar todos
10:32  Entregadores notificados
10:32  Entregador aceitou
10:45  Coleta realizada
11:03  Em entrega
11:17  Entrega concluída
```

## 📁 Estrutura inicial

```text
busca-la/
├── migrations/
├── src/
│   ├── public/
│   │   ├── css/
│   │   ├── icons/
│   │   └── js/
│   │
│   ├── server/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── app.js
│   │   └── server.js
│   │
│   └── views/
│       ├── admin/
│       ├── entregador/
│       ├── layouts/
│       ├── partials/
│       └── solicitante/
│
├── tests/
├── index.html
├── README.md
└── .gitignore
```

## 🚧 Status

**Em desenvolvimento**

O projeto está na fase inicial de definição da arquitetura e funcionalidades.

## 🗺️ Roadmap inicial

* [ ] Estrutura inicial do projeto
* [ ] Configuração Node.js
* [ ] Configuração PostgreSQL
* [ ] Sistema de autenticação
* [ ] Cadastro de entregadores
* [ ] Cadastro de solicitantes
* [ ] Aprovação de entregadores
* [ ] Controle online/offline
* [ ] Criação de pedidos
* [ ] Chamar todos
* [ ] Pedido direcionado
* [ ] Aceite de pedidos
* [ ] Fluxo de status da entrega
* [ ] Histórico de entregas
* [ ] Notificações
* [ ] Painel do entregador
* [ ] Painel do solicitante
* [ ] Painel administrativo
* [ ] PWA
* [ ] Testes
* [ ] Deploy

## 📄 Licença

A licença do projeto será definida posteriormente.

