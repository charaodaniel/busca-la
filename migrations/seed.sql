-- Seed do Busca Lá: usuário principal + testes + entregadores/pedidos demo
-- Uso: psql "$DATABASE_URL" -f seed.sql  (idempotente: usa ON CONFLICT)

-- 1) Usuário principal
INSERT INTO usuarios (nome, username, email, telefone, cpf, senha_hash, papel)
VALUES (
  'Daniel Charão',
  'daniel',
  'daniel@buscala.app',
  '55996393353',
  '02049495010',
  '2f151d786b78f32709c8c1fd0b9d2a2c:7b57193073c8a3f680ae3f7dff0c0e20de669a7594d48782c2b453096ff370dfe45f97be40c580f3885e8780ad8773c533651354847e94ecc5b41bdccd39b42a',
  'admin'
)
ON CONFLICT (telefone) DO UPDATE SET senha_hash = EXCLUDED.senha_hash;

-- 2) Usuários de teste (todos com senha 02061994)
INSERT INTO usuarios (nome, username, email, telefone, cpf, senha_hash, papel)
VALUES
  ('Maria Teste',     'maria', 'maria@teste.com', '55988880001', '11122233301',
   '022dbf3f23cec3458486322d9ebbc2e6:ad7498a1110aecd1df82373e32dc63765b5acd230c01242e8b591c83e7f05b3b643a3f33107e28e951b2340c02792c3fd103ef01c83a6038e2bd066ba2a74f4d',
   'solicitante'),
  ('João Entregador', 'joao',  'joao@teste.com',  '55988880002', '11122233302',
   '1346ffcfd1cbcdbbd9aaa3b8bc27b8c6:d2ab4c7d1ece239cb02bbad83b86a43aa783bdf0f87c61230bc0fd3c1928a4aff4a66c8cec274bea1336a88b87b17a6d36ca2ac8cfbe5e7c7da6f365a7a8c9d8',
   'entregador'),
  ('Ana Operadora',   'ana',   'ana@teste.com',   '55988880003', '11122233303',
   'f8dde139d0d4d81dd229fea9217383c2:7be4c2a2e03d5d7b7508c99ac2743a55cb2d6e20146cc7153725713814e97ab4e2122379ce20121e7c4d87411ef899304f5e286c39ac8915bf6906ff88fa9327',
   'operador')
ON CONFLICT DO NOTHING;

-- 3) Entregadores demo (vínculo com usuário joao no primeiro)
INSERT INTO entregadores (usuario_id, nome, telefone, veiculo, placa, online, aprovacao, nota, entregas, ganhos_hoje)
VALUES
  ((SELECT id FROM usuarios WHERE username='joao'), 'João Entregador', '(55) 98888-0002', 'Moto - Honda CG 160', 'ABC1D23', TRUE, 'aprovado', 4.9, 148, 82.50),
  (NULL, 'Marcos Souza', '(11) 98765-1002', 'Bicicleta Elétrica Caloi', 'N/A (Ciclo)', TRUE, 'aprovado', 4.8, 92, 45.00),
  (NULL, 'Carlos Eduardo', '(11) 98765-1003', 'Moto - Yamaha Fazer 250', 'SPX-9A44', FALSE, 'aprovado', 5.0, 215, 0),
  (NULL, 'Larissa Mendes', '(11) 98765-1004', 'Carro - Fiat Uno Vivace', 'FLR-4B33', TRUE, 'pendente', 5.0, 0, 0);

-- 4) Pedidos demo
INSERT INTO pedidos (
  codigo, solicitante_nome, solicitante_telefone, endereco_origem, endereco_destino,
  distancia_km, preco, descricao, observacoes, modo_despacho, entregador_id, status,
  coleta_lat, coleta_lng, coleta_label, destino_lat, destino_lng, destino_label,
  criado_em
)
VALUES
  ('BL-1082', 'Mercado Central & Hortifruti', '(11) 97123-4567',
   'Rua Principal, 120 - Mercado Central', 'Rua das Flores, 450 - Bairro Centro',
   4.2, 15.00, 'Caixa de produtos frescos e hortaliças (2 volumes)',
   'Entregar na portaria do condomínio Ed. Primavera', 'chamar_todos', NULL, 'aguardando_aceite',
   -23.5418, -46.6295, 'Mercado Central', -23.5505, -46.6333, 'Rua das Flores, 450',
   now() - interval '12 minutes'),

  ('BL-1081', 'Farmácia Viva Bem', '(11) 98321-9988',
   'Av. Brasil, 800 - Jardim América', 'Alameda dos Ipês, 75 - Apto 32',
   2.8, 12.50, 'Medicamentos e produtos de higiene (embalagem lacrada)',
   'Interfone 32. Recebedora Sra. Maria', 'direcionado',
   (SELECT id FROM entregadores WHERE placa='ABC1D23'), 'em_entrega',
   -23.5670, -46.6710, 'Farmácia Viva Bem', -23.5850, -46.6820, 'Alameda dos Ipês, 75',
   now() - interval '35 minutes'),

  ('BL-1080', 'Papelaria & Gráfica Express', '(11) 99456-7890',
   'Rua do Comércio, 50 - Centro', 'Praça da Matriz, 12 - Sala 401',
   1.5, 10.00, 'Documentos e pastas contratuais urgentes',
   'Procurar recepcionista Camila no 4º andar', 'chamar_todos',
   (SELECT id FROM entregadores WHERE placa='N/A (Ciclo)'), 'concluido',
   -23.5480, -46.6360, 'Papelaria & Gráfica', -23.5520, -46.6390, 'Praça da Matriz',
   now() - interval '75 minutes'),

  ('BL-1079', 'Restaurante Sabor de Casa', '(11) 98877-6655',
   'Rua Bela Cintra, 410 - Consolação', 'Av. Brigadeiro Faria Lima, 2200 - Pinheiros',
   5.1, 18.00, '3 marmitas térmicas e sacola com sobremesas',
   'Entregar na recepção do 12º andar', 'direcionado',
   (SELECT id FROM entregadores WHERE placa='ABC1D23'), 'concluido',
   -23.5530, -46.6610, 'Restaurante Sabor de Casa', -23.5780, -46.6890, 'Av. Faria Lima, 2200',
   now() - interval '130 minutes'),

  ('BL-1077', 'Livraria Dom Casmurro', '(11) 98112-3344',
   'Rua Domingos de Morais, 1500 - Vila Mariana', 'Rua Vergueiro, 2500 - Chácara Klabin',
   2.7, 13.00, 'Kit de livros didáticos encadernados',
   'Cancelado a pedido do cliente da livraria', 'direcionado',
   (SELECT id FROM entregadores WHERE placa='ABC1D23'), 'cancelado',
   -23.5890, -46.6380, 'Livraria Dom Casmurro', -23.5930, -46.6310, 'Rua Vergueiro, 2500',
   now() - interval '26 hours');

-- 5) Eventos dos pedidos
INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '10:31', 'Solicitação de entrega criada pelo Solicitante'
FROM pedidos p WHERE p.codigo='BL-1082';
INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '10:31', 'Despacho via "Chamar Todos": entregadores online notificados'
FROM pedidos p WHERE p.codigo='BL-1082';

INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '10:15', 'Solicitação criada e direcionada para João Entregador'
FROM pedidos p WHERE p.codigo='BL-1081';
INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '10:16', 'Pedido aceito pelo entregador João Entregador'
FROM pedidos p WHERE p.codigo='BL-1081';
INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '10:28', 'Encomenda coletada. Em rota para o destino'
FROM pedidos p WHERE p.codigo='BL-1081';

INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '09:40', 'Solicitação criada via "Chamar Todos"'
FROM pedidos p WHERE p.codigo='BL-1080';
INSERT INTO pedido_eventos (pedido_id, hora, descricao)
SELECT p.id, '09:58', 'Entrega finalizada com sucesso. Protocolo assinado.'
FROM pedidos p WHERE p.codigo='BL-1080';

-- Avaliação demo no BL-1080
UPDATE pedidos SET avaliacao_usuario = '{"stars":5,"comment":"Entrega muito rápida e cuidadosa.","tags":["Rápido ⚡"],"ratedAt":"2026-10-04T10:02:00.000Z"}'::jsonb
WHERE codigo='BL-1080';
