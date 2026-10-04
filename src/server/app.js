import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-Memory Database Store for Demo / Active Runtime
let drivers = [
  {
    id: 'drv-1',
    name: 'João da Silva',
    phone: '(11) 98765-1001',
    vehicle: 'Moto - Honda CG 160',
    plate: 'BRA-2E19',
    rating: 4.9,
    deliveriesCount: 148,
    isOnline: true,
    status: 'online', // 'online' | 'offline' | 'ocupado'
    approvalStatus: 'aprovado', // 'aprovado' | 'pendente' | 'bloqueado'
    todayEarnings: 82.50,
  },
  {
    id: 'drv-2',
    name: 'Marcos Souza',
    phone: '(11) 98765-1002',
    vehicle: 'Bicicleta Elétrica Caloi',
    plate: 'N/A (Ciclo)',
    rating: 4.8,
    deliveriesCount: 92,
    isOnline: true,
    status: 'online',
    approvalStatus: 'aprovado',
    todayEarnings: 45.00,
  },
  {
    id: 'drv-3',
    name: 'Carlos Eduardo',
    phone: '(11) 98765-1003',
    vehicle: 'Moto - Yamaha Fazer 250',
    plate: 'SPX-9A44',
    rating: 5.0,
    deliveriesCount: 215,
    isOnline: false,
    status: 'offline',
    approvalStatus: 'aprovado',
    todayEarnings: 0.00,
  },
  {
    id: 'drv-4',
    name: 'Larissa Mendes',
    phone: '(11) 98765-1004',
    vehicle: 'Carro - Fiat Uno Vivace',
    plate: 'FLR-4B33',
    rating: 5.0,
    deliveriesCount: 0,
    isOnline: true,
    status: 'online',
    approvalStatus: 'pendente',
    todayEarnings: 0.00,
  }
];

let orders = [
  {
    id: 'BL-1082',
    requesterName: 'Mercado Central & Hortifruti',
    requesterPhone: '(11) 97123-4567',
    originAddress: 'Rua Principal, 120 - Mercado Central',
    destinationAddress: 'Rua das Flores, 450 - Bairro Centro',
    distanceKm: 4.2,
    price: 15.00,
    description: 'Caixa de produtos frescos e hortaliças (2 volumes)',
    notes: 'Entregar na portaria do condomínio Ed. Primavera',
    dispatchMode: 'chamar_todos', // 'chamar_todos' | 'direcionado'
    assignedDriverId: null,
    assignedDriverName: null,
    status: 'aguardando_aceite', // 'aguardando_aceite' | 'aceito' | 'em_coleta' | 'em_entrega' | 'concluido' | 'cancelado'
    pickupCoords: { lat: -23.5418, lng: -46.6295, label: 'Mercado Central' },
    dropoffCoords: { lat: -23.5505, lng: -46.6333, label: 'Rua das Flores, 450' },
    driverCoords: { lat: -23.5450, lng: -46.6310 },
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    events: [
      { time: '10:31', description: 'Solicitação de entrega criada pelo Solicitante' },
      { time: '10:31', description: 'Despacho via "Chamar Todos": entregadores online notificados' }
    ]
  },
  {
    id: 'BL-1081',
    requesterName: 'Farmácia Viva Bem',
    requesterPhone: '(11) 98321-9988',
    originAddress: 'Av. Brasil, 800 - Jardim América',
    destinationAddress: 'Alameda dos Ipês, 75 - Apto 32',
    distanceKm: 2.8,
    price: 12.50,
    description: 'Medicamentos e produtos de higiene (embalagem lacrada)',
    notes: 'Interfone 32. Recebedora Sra. Maria',
    dispatchMode: 'direcionado',
    assignedDriverId: 'drv-1',
    assignedDriverName: 'João da Silva',
    status: 'em_entrega',
    pickupCoords: { lat: -23.5670, lng: -46.6710, label: 'Farmácia Viva Bem' },
    dropoffCoords: { lat: -23.5850, lng: -46.6820, label: 'Alameda dos Ipês, 75' },
    driverCoords: { lat: -23.5760, lng: -46.6765 },
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    events: [
      { time: '10:15', description: 'Solicitação criada e direcionada para João da Silva' },
      { time: '10:16', description: 'Pedido aceito pelo entregador João da Silva' },
      { time: '10:24', description: 'Entregador chegou ao ponto de coleta (Farmácia Viva Bem)' },
      { time: '10:28', description: 'Encomenda coletada. Em rota para o destino' }
    ]
  },
  {
    id: 'BL-1080',
    requesterName: 'Papelaria & Gráfica Express',
    requesterPhone: '(11) 99456-7890',
    originAddress: 'Rua do Comércio, 50 - Centro',
    destinationAddress: 'Praça da Matriz, 12 - Sala 401',
    distanceKm: 1.5,
    price: 10.00,
    description: 'Documentos e pastas contratuais urgentes',
    notes: 'Procurar recepcionista Camila no 4º andar',
    dispatchMode: 'chamar_todos',
    assignedDriverId: 'drv-2',
    assignedDriverName: 'Marcos Souza',
    status: 'concluido',
    pickupCoords: { lat: -23.5480, lng: -46.6360, label: 'Papelaria & Gráfica' },
    dropoffCoords: { lat: -23.5520, lng: -46.6390, label: 'Praça da Matriz' },
    driverCoords: { lat: -23.5520, lng: -46.6390 },
    userRating: {
      stars: 5,
      comment: 'Entrega muito rápida e cuidadosa. Entregador educado e pontual.',
      tags: ['Rápido ⚡', 'Educado 😊'],
      ratedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
    },
    driverRating: {
      stars: 5,
      comment: 'Solicitante super prestativo, entrega entregue sem demora na recepção.',
      tags: ['Fácil localização 📍', 'Rápido no recebimento 👍'],
      ratedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString()
    },
    createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    events: [
      { time: '09:40', description: 'Solicitação criada via "Chamar Todos"' },
      { time: '09:42', description: 'Aceito por Marcos Souza' },
      { time: '09:50', description: 'Coleta realizada' },
      { time: '09:58', description: 'Entrega finalizada com sucesso. Protocolo assinado.' },
      { time: '10:02', description: 'Solicitante avaliou a entrega com 5 estrelas ⭐' },
      { time: '10:05', description: 'Entregador avaliou o solicitante com 5 estrelas ⭐' }
    ]
  },
  {
    id: 'BL-1079',
    requesterName: 'Restaurante Sabor de Casa',
    requesterPhone: '(11) 98877-6655',
    originAddress: 'Rua Bela Cintra, 410 - Consolação',
    destinationAddress: 'Av. Brigadeiro Faria Lima, 2200 - Pinheiros',
    distanceKm: 5.1,
    price: 18.00,
    description: '3 marmitas térmicas e sacola com sobremesas',
    notes: 'Entregar na recepção do 12º andar',
    dispatchMode: 'direcionado',
    assignedDriverId: 'drv-1',
    assignedDriverName: 'João da Silva',
    status: 'concluido',
    pickupCoords: { lat: -23.5530, lng: -46.6610, label: 'Restaurante Sabor de Casa' },
    dropoffCoords: { lat: -23.5780, lng: -46.6890, label: 'Av. Faria Lima, 2200' },
    driverCoords: { lat: -23.5780, lng: -46.6890 },
    userRating: {
      stars: 5,
      comment: 'Chegou quentinho, embalagem intacta e super rápido!',
      tags: ['Super Rápido ⚡', 'Cuidado com o Pacote 📦'],
      ratedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString()
    },
    driverRating: {
      stars: 5,
      comment: 'Ponto de coleta muito organizado e rápido para retirar.',
      tags: ['Pronto na Chegada ⏱️', 'Muito Gentil 😊'],
      ratedAt: new Date(Date.now() - 105 * 60 * 1000).toISOString()
    },
    createdAt: new Date(Date.now() - 130 * 60 * 1000).toISOString(),
    events: [
      { time: '08:50', description: 'Solicitação criada no Busca Lá' },
      { time: '08:52', description: 'Aceito por João da Silva' },
      { time: '09:05', description: 'Coleta efetuada no Restaurante Sabor de Casa' },
      { time: '09:22', description: 'Entrega realizada e assinada por Carlos Rocha' },
      { time: '09:26', description: 'Solicitante avaliou a entrega com 5 estrelas ⭐' }
    ]
  },
  {
    id: 'BL-1078',
    requesterName: 'Ótica Visão Cristal',
    requesterPhone: '(11) 97654-3210',
    originAddress: 'Rua Teodoro Sampaio, 1020 - Pinheiros',
    destinationAddress: 'Rua Oscar Freire, 550 - Cerqueira César',
    distanceKm: 2.3,
    price: 11.50,
    description: 'Armações de óculos e lentes para laboratório',
    notes: 'Frágil - manusear com cuidado',
    dispatchMode: 'chamar_todos',
    assignedDriverId: 'drv-1',
    assignedDriverName: 'João da Silva',
    status: 'concluido',
    pickupCoords: { lat: -23.5610, lng: -46.6830, label: 'Ótica Visão Cristal' },
    dropoffCoords: { lat: -23.5640, lng: -46.6700, label: 'Rua Oscar Freire, 550' },
    driverCoords: { lat: -23.5640, lng: -46.6700 },
    userRating: {
      stars: 4,
      comment: 'Entregador pontual e muito cuidadoso com a carga frágil.',
      tags: ['Pontual ⏱️', 'Cuidado com o Pacote 📦'],
      ratedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString()
    },
    driverRating: {
      stars: 5,
      comment: 'Tudo pronto e conferido rapidamente na chegada.',
      tags: ['Rápido no Recebimento 👍', 'Fácil Localização 📍'],
      ratedAt: new Date(Date.now() - 175 * 60 * 1000).toISOString()
    },
    createdAt: new Date(Date.now() - 200 * 60 * 1000).toISOString(),
    events: [
      { time: '07:45', description: 'Solicitação criada no Busca Lá' },
      { time: '07:47', description: 'Aceito por João da Silva' },
      { time: '07:58', description: 'Coleta efetuada na Ótica Visão Cristal' },
      { time: '08:14', description: 'Entrega concluída com protocolo digital assinado' }
    ]
  },
  {
    id: 'BL-1077',
    requesterName: 'Livraria Dom Casmurro',
    requesterPhone: '(11) 98112-3344',
    originAddress: 'Rua Domingos de Morais, 1500 - Vila Mariana',
    destinationAddress: 'Rua Vergueiro, 2500 - Chácara Klabin',
    distanceKm: 2.7,
    price: 13.00,
    description: 'Kit de livros didáticos encadernados',
    notes: 'Cancelado a pedido do cliente da livraria',
    dispatchMode: 'direcionado',
    assignedDriverId: 'drv-1',
    assignedDriverName: 'João da Silva',
    status: 'cancelado',
    cancelReason: 'Solicitante cancelou o pedido antes da coleta',
    pickupCoords: { lat: -23.5890, lng: -46.6380, label: 'Livraria Dom Casmurro' },
    dropoffCoords: { lat: -23.5930, lng: -46.6310, label: 'Rua Vergueiro, 2500' },
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    events: [
      { time: 'Ontem 14:10', description: 'Solicitação criada' },
      { time: 'Ontem 14:12', description: 'Aceito por João da Silva' },
      { time: 'Ontem 14:18', description: 'Cancelado pelo solicitante (motivo: cliente desistiu da compra)' }
    ]
  },
  {
    id: 'BL-1076',
    requesterName: 'Floricultura Jardim das Flores',
    requesterPhone: '(11) 97234-5566',
    originAddress: 'Av. Ibirapuera, 2100 - Moema',
    destinationAddress: 'Rua Pamplona, 900 - Jardim Paulista',
    distanceKm: 4.8,
    price: 17.50,
    description: 'Arranjo floral de orquídeas e cartão',
    notes: 'Manter vaso na vertical',
    dispatchMode: 'chamar_todos',
    assignedDriverId: 'drv-2',
    assignedDriverName: 'Marcos Souza',
    status: 'concluido',
    pickupCoords: { lat: -23.6020, lng: -46.6630, label: 'Floricultura Jardim das Flores' },
    dropoffCoords: { lat: -23.5670, lng: -46.6540, label: 'Rua Pamplona, 900' },
    userRating: {
      stars: 5,
      comment: 'Flores intactas e entrega pontual!',
      tags: ['Pontual ⏱️', 'Cuidado com o Pacote 📦'],
      ratedAt: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString()
    },
    driverRating: {
      stars: 5,
      comment: 'Embalagem perfeita para transporte de moto.',
      tags: ['Fácil Localização 📍'],
      ratedAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString()
    },
    createdAt: new Date(Date.now() - 52 * 60 * 60 * 1000).toISOString(),
    events: [
      { time: 'Anteontem 11:00', description: 'Solicitação criada no Busca Lá' },
      { time: 'Anteontem 11:03', description: 'Aceito por Marcos Souza' },
      { time: 'Anteontem 11:15', description: 'Coleta de arranjo realizada' },
      { time: 'Anteontem 11:35', description: 'Entrega realizada com sucesso' }
    ]
  }
];

function getStats() {
  const activeOrders = orders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado').length;
  const completedOrders = orders.filter(o => o.status === 'concluido').length;
  const onlineDrivers = drivers.filter(d => d.isOnline && d.approvalStatus === 'aprovado').length;
  const totalVolume = orders
    .filter(o => o.status === 'concluido' || o.status === 'em_entrega')
    .reduce((acc, cur) => acc + (cur.price || 0), 0);

  return {
    activeOrders,
    completedOrders,
    onlineDrivers,
    totalDrivers: drivers.length,
    totalVolumeToday: totalVolume.toFixed(2),
  };
}

// REST API ROUTES
app.get('/api/state', (req, res) => {
  res.json({
    drivers,
    orders,
    stats: getStats()
  });
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const {
    requesterName,
    requesterPhone,
    originAddress,
    destinationAddress,
    distanceKm,
    price,
    description,
    notes,
    dispatchMode,
    assignedDriverId
  } = req.body;

  if (!originAddress || !destinationAddress || !description) {
    return res.status(400).json({ error: 'Origem, destino e descrição são obrigatórios.' });
  }

  const newId = `BL-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date();
  const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let driverName = null;
  if (dispatchMode === 'direcionado' && assignedDriverId) {
    const drv = drivers.find(d => d.id === assignedDriverId);
    if (drv) driverName = drv.name;
  }

  const newOrder = {
    id: newId,
    requesterName: requesterName || 'Comércio Solicitante',
    requesterPhone: requesterPhone || '(11) 99999-0000',
    originAddress,
    destinationAddress,
    distanceKm: parseFloat(distanceKm) || 3.5,
    price: parseFloat(price) || 14.00,
    description,
    notes: notes || '',
    dispatchMode: dispatchMode || 'chamar_todos',
    assignedDriverId: driverName ? assignedDriverId : null,
    assignedDriverName: driverName,
    status: 'aguardando_aceite',
    pickupCoords: { 
      lat: parseFloat((-23.5505 + (Math.random() - 0.5) * 0.03).toFixed(5)), 
      lng: parseFloat((-46.6333 + (Math.random() - 0.5) * 0.03).toFixed(5)),
      label: originAddress.split('-')[0].trim()
    },
    dropoffCoords: { 
      lat: parseFloat((-23.5505 + (Math.random() - 0.5) * 0.05).toFixed(5)), 
      lng: parseFloat((-46.6333 + (Math.random() - 0.5) * 0.05).toFixed(5)),
      label: destinationAddress.split('-')[0].trim()
    },
    driverCoords: { 
      lat: parseFloat((-23.5505 + (Math.random() - 0.5) * 0.02).toFixed(5)), 
      lng: parseFloat((-46.6333 + (Math.random() - 0.5) * 0.02).toFixed(5)) 
    },
    createdAt: now.toISOString(),
    events: [
      { time: timeString, description: 'Solicitação criada no Busca Lá' },
      { 
        time: timeString, 
        description: dispatchMode === 'direcionado' && driverName 
          ? `Pedido direcionado exclusivamente para ${driverName}` 
          : 'Chamado emitido para todos os entregadores disponíveis' 
      }
    ]
  };

  orders.unshift(newOrder);

  res.status(201).json({
    success: true,
    order: newOrder,
    stats: getStats()
  });
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, driverId } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }

  const now = new Date();
  const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (driverId) {
    const drv = drivers.find(d => d.id === driverId);
    if (drv) {
      order.assignedDriverId = drv.id;
      order.assignedDriverName = drv.name;
    }
  }

  order.status = status;

  let eventText = `Status atualizado para: ${status}`;
  if (status === 'aceito') {
    eventText = `Pedido aceito pelo entregador ${order.assignedDriverName || 'designado'}`;
  } else if (status === 'em_coleta') {
    eventText = 'Entregador chegou ao local de coleta';
  } else if (status === 'em_entrega') {
    eventText = 'Mercadoria retirada. Entregador em trânsito até o destino';
  } else if (status === 'concluido') {
    eventText = 'Entrega finalizada com sucesso e confirmada pelo recebedor';
    // Credit driver
    if (order.assignedDriverId) {
      const drv = drivers.find(d => d.id === order.assignedDriverId);
      if (drv) {
        drv.todayEarnings += order.price;
        drv.deliveriesCount += 1;
      }
    }
  } else if (status === 'cancelado') {
    eventText = 'Pedido cancelado pelo solicitante ou central';
  }

  order.events.push({
    time: timeString,
    description: eventText
  });

  res.json({
    success: true,
    order,
    stats: getStats()
  });
});

app.post('/api/orders/:id/rate', (req, res) => {
  const { id } = req.params;
  const { role, stars, comment, tags } = req.body; // role: 'solicitante' | 'entregador'

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }

  const now = new Date();
  const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const starNum = Math.min(5, Math.max(1, parseInt(stars, 10) || 5));

  if (role === 'solicitante') {
    order.userRating = {
      stars: starNum,
      comment: comment || '',
      tags: tags || [],
      ratedAt: now.toISOString()
    };
    order.events.push({
      time: timeString,
      description: `Solicitante avaliou a entrega com ${starNum} estrelas ⭐`
    });

    // Update driver's rating average
    if (order.assignedDriverId) {
      const drv = drivers.find(d => d.id === order.assignedDriverId);
      if (drv) {
        const ratedOrders = orders.filter(o => o.assignedDriverId === drv.id && o.userRating);
        const sumStars = ratedOrders.reduce((acc, cur) => acc + cur.userRating.stars, 0);
        // Base rating dampening (10 prior 5-star baseline)
        const newRating = ((sumStars + 50) / (ratedOrders.length + 10)).toFixed(1);
        drv.rating = parseFloat(newRating);
      }
    }
  } else if (role === 'entregador') {
    order.driverRating = {
      stars: starNum,
      comment: comment || '',
      tags: tags || [],
      ratedAt: now.toISOString()
    };
    order.events.push({
      time: timeString,
      description: `Entregador avaliou o solicitante com ${starNum} estrelas ⭐`
    });
  }

  res.json({
    success: true,
    order,
    stats: getStats()
  });
});

app.patch('/api/drivers/:id', (req, res) => {
  const { id } = req.params;
  const { isOnline, approvalStatus } = req.body;

  const driver = drivers.find(d => d.id === id);
  if (!driver) {
    return res.status(404).json({ error: 'Entregador não encontrado.' });
  }

  if (typeof isOnline === 'boolean') {
    driver.isOnline = isOnline;
    driver.status = isOnline ? 'online' : 'offline';
  }

  if (approvalStatus) {
    driver.approvalStatus = approvalStatus;
  }

  res.json({
    success: true,
    driver,
    stats: getStats()
  });
});

app.post('/api/drivers', (req, res) => {
  const { name, phone, vehicle, plate } = req.body;
  if (!name || !vehicle) {
    return res.status(400).json({ error: 'Nome e veículo são obrigatórios.' });
  }

  const newDriver = {
    id: `drv-${Date.now()}`,
    name,
    phone: phone || '(11) 98000-0000',
    vehicle,
    plate: plate || 'Placa em análise',
    rating: 5.0,
    deliveriesCount: 0,
    isOnline: true,
    status: 'online',
    approvalStatus: 'pendente',
    todayEarnings: 0.00
  };

  drivers.push(newDriver);
  res.status(201).json({ success: true, driver: newDriver });
});

// Explicit Dashboard Route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(rootDir, 'dashboard.html'));
});

app.get('/dashboard/:role', (req, res) => {
  res.sendFile(path.join(rootDir, 'dashboard.html'));
});

// Serve leaflet vendor assets
app.use('/vendor/leaflet', express.static(path.join(rootDir, 'node_modules/leaflet/dist')));

// Serve static assets from project root
app.use(express.static(rootDir));

// SPA fallback for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

export default app;
