import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { q } from './db.js';
import {
  hashSenha, verificarSenha, parseCookies, setSessionCookie,
  clearSessionCookie, criarSessao, buscarSessao, deletarSessao,
  usuarioSeguro, COOKIES,
} from './auth.js';
import {
  getPublicKey, saveSubscription, removeSubscription, notifyNewOrder, pushConfigured,
} from './push.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- helpers ----------
const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

function tempoAgora() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ---------- sessão em req.user ----------
app.use(async (req, _res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    req.sessionToken = cookies[COOKIES.SESSION] || null;
    req.user = await buscarSessao(req.sessionToken);
  } catch {
    req.user = null;
  }
  next();
});

// Gate opcional: REQUIRE_AUTH=1 exige login para /dashboard
app.use((req, res, next) => {
  if (process.env.REQUIRE_AUTH === '1' && !req.user && req.path.startsWith('/dashboard')) {
    return res.redirect('/login');
  }
  next();
});

// ---------- AUTH ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, username, email, telefone, cpf, senha, papel } = req.body;

    if (!nome || String(nome).trim().length < 3) {
      return res.status(400).json({ error: 'Informe seu nome completo.' });
    }
    if (!senha || String(senha).length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const docs = {
      username: username ? String(username).trim().toLowerCase() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      telefone: telefone ? onlyDigits(telefone) : null,
      cpf: cpf ? onlyDigits(cpf) : null,
    };

    if (!docs.username && !docs.email && !docs.telefone && !docs.cpf) {
      return res.status(400).json({
        error: 'Informe pelo menos um identificador: usuário, e-mail, telefone ou CPF.',
      });
    }
    if (docs.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(docs.email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (docs.telefone && (docs.telefone.length < 10 || docs.telefone.length > 13)) {
      return res.status(400).json({ error: 'Telefone inválido (use DDD + número).' });
    }
    if (docs.cpf && docs.cpf.length !== 11) {
      return res.status(400).json({ error: 'CPF deve ter 11 dígitos.' });
    }

    const role = ['entregador', 'solicitante', 'operador', 'admin'].includes(papel)
      ? papel : 'solicitante';

    // duplicidade
    for (const [campo, valor] of Object.entries(docs)) {
      if (!valor) continue;
      const col = campo === 'username' ? 'username' : campo;
      const dup = await q(`SELECT 1 FROM usuarios WHERE ${col} = $1`, [valor]);
      if (dup.rowCount > 0) {
        const rotulos = { username: 'nome de usuário', email: 'e-mail', telefone: 'telefone', cpf: 'CPF' };
        return res.status(409).json({ error: `Este ${rotulos[campo]} já está cadastrado.` });
      }
    }

    const hash = hashSenha(senha);
    const r = await q(
      `INSERT INTO usuarios (nome, username, email, telefone, cpf, senha_hash, papel)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, nome, username, email, telefone, cpf, papel`,
      [String(nome).trim(), docs.username, docs.email, docs.telefone, docs.cpf, hash, role]
    );
    const u = r.rows[0];

    const token = await criarSessao(u.id);
    setSessionCookie(res, token);
    res.status(201).json({ success: true, user: usuarioSeguro(u) });
  } catch (e) {
    console.error('register:', e);
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, senha } = req.body;
    if (!identifier || !senha) {
      return res.status(400).json({ error: 'Informe usuário e senha.' });
    }

    const raw = String(identifier).trim();
    const digitos = onlyDigits(raw);

    let sql;
    let params;
    if (raw.includes('@')) {
      sql = 'SELECT * FROM usuarios WHERE email = $1 AND ativo';
      params = [raw.toLowerCase()];
    } else if (digitos.length >= 10 && digitos.length <= 13) {
      // telefone (ou CPF colocado no campo de telefone)
      sql = 'SELECT * FROM usuarios WHERE (telefone = $1 OR cpf = $2) AND ativo';
      params = [digitos, digitos];
    } else if (digitos.length === 11 && raw.length === 11) {
      sql = 'SELECT * FROM usuarios WHERE cpf = $1 AND ativo';
      params = [digitos];
    } else {
      sql = 'SELECT * FROM usuarios WHERE username = $1 AND ativo';
      params = [raw.toLowerCase()];
    }

    const r = await q(sql, params);
    const u = r.rows[0];
    if (!u || !verificarSenha(senha, u.senha_hash)) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = await criarSessao(u.id);
    setSessionCookie(res, token);
    res.json({ success: true, user: usuarioSeguro(u) });
  } catch (e) {
    console.error('login:', e);
    res.status(500).json({ error: 'Erro ao entrar.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await deletarSessao(req.sessionToken);
  } finally {
    clearSessionCookie(res);
    res.json({ success: true });
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: usuarioSeguro(req.user) });
});

// ---------- WEB PUSH (VAPID) ----------
app.get('/api/push/public-key', (_req, res) => {
  res.json({ publicKey: getPublicKey(), enabled: pushConfigured });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const sub = req.body && req.body.subscription ? req.body.subscription : req.body;
    const id = await saveSubscription(sub, req.user ? req.user.id : null);
    if (!id) return res.status(400).json({ error: 'Subscription inválida.' });
    res.status(201).json({ success: true, id });
  } catch (e) {
    console.error('push subscribe:', e);
    res.status(500).json({ error: 'Erro ao registrar inscrição de push.' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    await removeSubscription(req.body && req.body.endpoint);
    res.json({ success: true });
  } catch (e) {
    console.error('push unsubscribe:', e);
    res.status(500).json({ error: 'Erro ao remover inscrição de push.' });
  }
});

// ---------- mapeamento DB -> frontend ----------
function mapDriver(d) {
  return {
    id: `drv-${d.id}`,
    name: d.nome,
    phone: d.telefone || '',
    vehicle: d.veiculo,
    plate: d.placa || 'N/A',
    rating: parseFloat(d.nota),
    deliveriesCount: d.entregas,
    isOnline: d.online,
    status: d.online ? 'online' : 'offline',
    approvalStatus: d.aprovacao,
    todayEarnings: parseFloat(d.ganhos_hoje),
  };
}

function mapOrder(o) {
  return {
    id: o.codigo,
    requesterName: o.solicitante_nome,
    requesterPhone: o.solicitante_telefone || '',
    originAddress: o.endereco_origem,
    destinationAddress: o.endereco_destino,
    distanceKm: parseFloat(o.distancia_km),
    price: parseFloat(o.preco),
    description: o.descricao,
    notes: o.observacoes || '',
    dispatchMode: o.modo_despacho,
    assignedDriverId: o.entregador_id ? `drv-${o.entregador_id}` : null,
    assignedDriverName: o.entregador_nome || null,
    status: o.status,
    cancelReason: o.cancelamento_motivo || undefined,
    pickupCoords: {
      lat: o.coleta_lat, lng: o.coleta_lng,
      label: o.coleta_label || o.endereco_origem.split('-')[0].trim(),
    },
    dropoffCoords: {
      lat: o.destino_lat, lng: o.destino_lng,
      label: o.destino_label || o.endereco_destino.split('-')[0].trim(),
    },
    driverCoords: o.entregador_lat != null
      ? { lat: o.entregador_lat, lng: o.entregador_lng }
      : { lat: o.coleta_lat, lng: o.coleta_lng },
    userRating: o.avaliacao_usuario || undefined,
    driverRating: o.avaliacao_entregador || undefined,
    createdAt: new Date(o.criado_em).toISOString(),
    events: (o.eventos || []).map((e) => ({ time: e.hora, description: e.descricao })),
  };
}

const SQL_PEDIDOS = `
  SELECT p.*, e.nome AS entregador_nome,
    COALESCE((
      SELECT json_agg(x ORDER BY x.id) FROM (
        SELECT id, hora, descricao FROM pedido_eventos
        WHERE pedido_id = p.id ORDER BY id
      ) x
    ), '[]'::json) AS eventos
  FROM pedidos p
  LEFT JOIN entregadores e ON e.id = p.entregador_id`;

async function carregarPedidos() {
  const r = await q(`${SQL_PEDIDOS} ORDER BY p.criado_em DESC`);
  return r.rows.map(mapOrder);
}

async function carregarEntregadores() {
  const r = await q('SELECT * FROM entregadores ORDER BY id');
  return r.rows.map(mapDriver);
}

async function getStats() {
  const r = await q(`
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('concluido','cancelado')) AS ativos,
      COUNT(*) FILTER (WHERE status = 'concluido') AS concluidos,
      COALESCE(SUM(preco) FILTER (WHERE status IN ('concluido','em_entrega')), 0) AS volume,
      (SELECT COUNT(*) FROM entregadores WHERE online AND aprovacao = 'aprovado') AS online_drv,
      (SELECT COUNT(*) FROM entregadores) AS total_drv
    FROM pedidos`);
  const s = r.rows[0];
  return {
    activeOrders: Number(s.ativos),
    completedOrders: Number(s.concluidos),
    onlineDrivers: Number(s.online_drv),
    totalDrivers: Number(s.total_drv),
    totalVolumeToday: Number(s.volume).toFixed(2),
  };
}

const EVENTOS_STATUS = {
  aceito: (o) => `Pedido aceito pelo entregador ${o.entregador_nome || 'designado'}`,
  em_coleta: () => 'Entregador chegou ao local de coleta',
  em_entrega: () => 'Mercadoria retirada. Entregador em trânsito até o destino',
  concluido: () => 'Entrega finalizada com sucesso e confirmada pelo recebedor',
  cancelado: () => 'Pedido cancelado pelo solicitante ou central',
};

// ---------- API (dados do PostgreSQL) ----------
app.get('/api/state', async (_req, res) => {
  try {
    const [drivers, orders, stats] = await Promise.all([
      carregarEntregadores(), carregarPedidos(), getStats(),
    ]);
    res.json({ drivers, orders, stats });
  } catch (e) {
    console.error('state:', e);
    res.status(500).json({ error: 'Erro no banco de dados.' });
  }
});

app.get('/api/orders', async (_req, res) => {
  try {
    res.json(await carregarPedidos());
  } catch (e) {
    console.error('orders:', e);
    res.status(500).json({ error: 'Erro no banco de dados.' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const {
      requesterName, requesterPhone, originAddress, destinationAddress,
      distanceKm, price, description, notes, dispatchMode, assignedDriverId,
    } = req.body;

    if (!originAddress || !destinationAddress || !description) {
      return res.status(400).json({ error: 'Origem, destino e descrição são obrigatórios.' });
    }

    let entregadorId = null;
    let entregadorNome = null;
    let entregadorUsuarioId = null;
    if (dispatchMode === 'direcionado' && assignedDriverId) {
      const drv = await q('SELECT id, nome, usuario_id FROM entregadores WHERE id = $1', [
        Number(String(assignedDriverId).replace(/^drv-/, '')) || 0,
      ]);
      if (drv.rows[0]) {
        entregadorId = drv.rows[0].id;
        entregadorNome = drv.rows[0].nome;
        entregadorUsuarioId = drv.rows[0].usuario_id || null;
      }
    }

    const rnd = (base, spread) => parseFloat((base + (Math.random() - 0.5) * spread).toFixed(5));
    const agora = new Date();
    const t = tempoAgora();
    const codigo = `BL-${Math.floor(1000 + Math.random() * 9000)}`;

    const r = await q(
      `INSERT INTO pedidos (
         codigo, usuario_id, solicitante_nome, solicitante_telefone,
         endereco_origem, endereco_destino, distancia_km, preco,
         descricao, observacoes, modo_despacho, entregador_id, status,
         coleta_lat, coleta_lng, coleta_label,
         destino_lat, destino_lng, destino_label,
         entregador_lat, entregador_lng
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'aguardando_aceite',
                 $13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        codigo, req.user ? req.user.id : null,
        requesterName || 'Comércio Solicitante',
        requesterPhone || '(11) 99999-0000',
        originAddress, destinationAddress,
        parseFloat(distanceKm) || 3.5, parseFloat(price) || 14.0,
        description, notes || '', dispatchMode || 'chamar_todos', entregadorId,
        rnd(-23.5505, 0.03), rnd(-46.6333, 0.03), originAddress.split('-')[0].trim(),
        rnd(-23.5505, 0.05), rnd(-46.6333, 0.05), destinationAddress.split('-')[0].trim(),
        rnd(-23.5505, 0.02), rnd(-46.6333, 0.02),
      ]
    );
    const pedidoId = r.rows[0].id;

    await q(
      `INSERT INTO pedido_eventos (pedido_id, hora, descricao) VALUES
       ($1,$2,'Solicitação criada no Busca Lá'),
       ($1,$2,$3)`,
      [pedidoId, t,
        entregadorNome
          ? `Pedido direcionado exclusivamente para ${entregadorNome}`
          : 'Chamado emitido para todos os entregadores disponíveis']
    );

    const full = await q(`${SQL_PEDIDOS} WHERE p.id = $1`, [pedidoId]);
    const order = mapOrder(full.rows[0]);

    // Web Push (fire-and-forget): avisa o entregador-alvo ou todos os inscritos
    notifyNewOrder({ order, targetUsuarioId: entregadorUsuarioId }).catch((err) =>
      console.error('push new order:', err)
    );

    res.status(201).json({
      success: true,
      order,
      stats: await getStats(),
    });
  } catch (e) {
    console.error('create order:', e);
    res.status(500).json({ error: 'Erro ao criar pedido.' });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status, driverId } = req.body;
    const validos = Object.keys(EVENTOS_STATUS);
    if (!validos.includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }

    const found = await q('SELECT id FROM pedidos WHERE codigo = $1', [req.params.id]);
    if (!found.rows[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const pedidoId = found.rows[0].id;

    if (driverId) {
      const drv = await q('SELECT id, nome FROM entregadores WHERE id = $1', [
        Number(String(driverId).replace(/^drv-/, '')) || 0,
      ]);
      if (drv.rows[0]) {
        await q('UPDATE pedidos SET entregador_id = $1 WHERE id = $2', [drv.rows[0].id, pedidoId]);
      }
    }

    await q('UPDATE pedidos SET status = $1 WHERE id = $2', [status, pedidoId]);

    if (status === 'concluido') {
      await q(
        `UPDATE entregadores SET
           ganhos_hoje = ganhos_hoje + p.preco,
           entregas = entregas + 1
         FROM pedidos p
         WHERE entregadores.id = p.entregador_id AND p.id = $1`,
        [pedidoId]
      );
    }

    const full = await q(`${SQL_PEDIDOS} WHERE p.id = $1`, [pedidoId]);
    const o = full.rows[0];
    await q('INSERT INTO pedido_eventos (pedido_id, hora, descricao) VALUES ($1,$2,$3)', [
      pedidoId, tempoAgora(), EVENTOS_STATUS[status](o),
    ]);

    const refreshed = await q(`${SQL_PEDIDOS} WHERE p.id = $1`, [pedidoId]);
    res.json({ success: true, order: mapOrder(refreshed.rows[0]), stats: await getStats() });
  } catch (e) {
    console.error('status:', e);
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

app.post('/api/orders/:id/rate', async (req, res) => {
  try {
    const { role, stars, comment, tags } = req.body;
    const found = await q('SELECT id, entregador_id FROM pedidos WHERE codigo = $1', [req.params.id]);
    if (!found.rows[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const pedidoId = found.rows[0].id;
    const starNum = Math.min(5, Math.max(1, parseInt(stars, 10) || 5));
    const t = tempoAgora();
    const payload = JSON.stringify({
      stars: starNum, comment: comment || '', tags: tags || [],
      ratedAt: new Date().toISOString(),
    });

    if (role === 'solicitante') {
      await q(
        'UPDATE pedidos SET avaliacao_usuario = $1::jsonb WHERE id = $2',
        [payload, pedidoId]
      );
      await q('INSERT INTO pedido_eventos (pedido_id, hora, descricao) VALUES ($1,$2,$3)', [
        pedidoId, t, `Solicitante avaliou a entrega com ${starNum} estrelas ⭐`,
      ]);
      // recalcula média do entregador (com base de 10 avaliações 5 estrelas)
      if (found.rows[0].entregador_id) {
        await q(
          `UPDATE entregadores e SET nota = sub.media FROM (
             SELECT ROUND(((SUM((p.avaliacao_usuario->>'stars')::int) + 50)
               / (COUNT(p.id) + 10.0))::numeric, 1) AS media
             FROM pedidos p
             WHERE p.entregador_id = $1 AND p.avaliacao_usuario IS NOT NULL
           ) sub WHERE e.id = $1`,
          [found.rows[0].entregador_id]
        );
      }
    } else if (role === 'entregador') {
      await q(
        'UPDATE pedidos SET avaliacao_entregador = $1::jsonb WHERE id = $2',
        [payload, pedidoId]
      );
      await q('INSERT INTO pedido_eventos (pedido_id, hora, descricao) VALUES ($1,$2,$3)', [
        pedidoId, t, `Entregador avaliou o solicitante com ${starNum} estrelas ⭐`,
      ]);
    } else {
      return res.status(400).json({ error: 'Role inválido.' });
    }

    const full = await q(`${SQL_PEDIDOS} WHERE p.id = $1`, [pedidoId]);
    res.json({ success: true, order: mapOrder(full.rows[0]), stats: await getStats() });
  } catch (e) {
    console.error('rate:', e);
    res.status(500).json({ error: 'Erro ao avaliar.' });
  }
});

app.patch('/api/drivers/:id', async (req, res) => {
  try {
    const id = Number(String(req.params.id).replace(/^drv-/, '')) || 0;
    const { isOnline, approvalStatus } = req.body;
    const found = await q('SELECT id FROM entregadores WHERE id = $1', [id]);
    if (!found.rows[0]) return res.status(404).json({ error: 'Entregador não encontrado.' });

    if (typeof isOnline === 'boolean') {
      await q('UPDATE entregadores SET online = $1 WHERE id = $2', [isOnline, id]);
    }
    if (approvalStatus && ['aprovado', 'pendente', 'bloqueado'].includes(approvalStatus)) {
      await q('UPDATE entregadores SET aprovacao = $1 WHERE id = $2', [approvalStatus, id]);
    }

    const full = await q('SELECT * FROM entregadores WHERE id = $1', [id]);
    res.json({ success: true, driver: mapDriver(full.rows[0]), stats: await getStats() });
  } catch (e) {
    console.error('driver patch:', e);
    res.status(500).json({ error: 'Erro ao atualizar entregador.' });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const { name, phone, vehicle, plate } = req.body;
    if (!name || !vehicle) {
      return res.status(400).json({ error: 'Nome e veículo são obrigatórios.' });
    }
    const r = await q(
      `INSERT INTO entregadores (nome, telefone, veiculo, placa, aprovacao)
       VALUES ($1,$2,$3,$4,'pendente') RETURNING *`,
      [name, phone || '(11) 98000-0000', vehicle, plate || 'Placa em análise']
    );
    res.status(201).json({ success: true, driver: mapDriver(r.rows[0]) });
  } catch (e) {
    console.error('driver create:', e);
    res.status(500).json({ error: 'Erro ao cadastrar entregador.' });
  }
});

// ---------- páginas ----------
app.get('/login', (_req, res) => res.sendFile(path.join(rootDir, 'login.html')));
app.get('/cadastro', (_req, res) => res.sendFile(path.join(rootDir, 'cadastro.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(rootDir, 'dashboard.html')));
app.get('/dashboard/:role', (_req, res) => res.sendFile(path.join(rootDir, 'dashboard.html')));

app.use('/vendor/leaflet', express.static(path.join(rootDir, 'node_modules/leaflet/dist')));
app.use(express.static(rootDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

export default app;
