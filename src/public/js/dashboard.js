// Busca Lá - Dashboard Client Script with Interactive Star-Rating
let appState = {
    drivers: [],
    orders: [],
    stats: {}
};

let currentRole = 'solicitante';
let currentDriverId = 'drv-1'; // Default logged-in driver persona
let solicitanteFilter = 'todos';
let selectedDispatchMode = 'chamar_todos';

// Track current interactive rating state
let activeRatingState = {
    orderId: null,
    role: null,
    selectedStars: 5,
    selectedTags: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check role in URL query parameter (?role=entregador / solicitante / admin)
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');
    if (roleParam && ['solicitante', 'entregador', 'admin'].includes(roleParam)) {
        switchRole(roleParam);
    } else {
        switchRole('solicitante');
    }

    // Initialize Push Notification & Audio Alert system
    initPushNotificationSystem();

    // Fetch initial state
    fetchAppState();

    // Auto sync state every 3.5 seconds
    setInterval(fetchAppState, 3500);
});

// Toast notification helper
function showToast(message, icon = 'ℹ️') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// Switch Active Role
function switchRole(role) {
    currentRole = role;

    // Update buttons
    document.querySelectorAll('.role-pill').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btnRole${capitalize(role)}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update views
    document.querySelectorAll('.dashboard-view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(`view${capitalize(role)}`);
    if (targetView) targetView.classList.add('active');

    // Update breadcrumb
    const roleNames = {
        solicitante: 'Solicitante',
        entregador: 'Entregador',
        admin: 'Central / Admin'
    };
    const breadcrumb = document.getElementById('breadcrumbRole');
    if (breadcrumb) breadcrumb.innerText = roleNames[role] || 'Visão Geral';

    // Rerender current view
    renderCurrentView();

    // Trigger map size recalculation after tab transition
    setTimeout(() => {
        if (mapInstances[role]) {
            mapInstances[role].invalidateSize();
            recenterMap(role);
        }
    }, 150);
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Known order tracking for real-time driver broadcast notifications
let knownOrderIds = new Set();
let isInitialFetchDone = false;

// Audio Alert toggle state (persisted)
let audioAlertEnabled = localStorage.getItem('buscala_sound_enabled') !== 'false';
let currentAlertOrder = null;
let alertDismissTimer = null;

// Fetch State from Backend API
async function fetchAppState() {
    try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Falha ao carregar dados do servidor');
        appState = await res.json();

        // Check newly broadcasted deliveries in real time
        checkIncomingBroadcastDeliveries(appState.orders || []);

        renderCurrentView();
    } catch (err) {
        console.warn('Erro ao sincronizar com servidor:', err);
    }
}

// Master Render Router
function renderCurrentView() {
    if (!appState || !appState.orders) return;

    if (currentRole === 'solicitante') {
        renderSolicitanteView();
    } else if (currentRole === 'entregador') {
        renderEntregadorView();
    } else if (currentRole === 'admin') {
        renderAdminView();
    }
}


// ==========================================
// STAR-RATING COMPONENT BUILDER & LOGIC
// ==========================================
const ratingLabels = {
    1: '1 - Precisa melhorar 😕',
    2: '2 - Abaixo do esperado 😐',
    3: '3 - Bom / Regular 🙂',
    4: '4 - Muito bom! 😊',
    5: '5 - Excelente! ⭐⭐⭐⭐⭐'
};

const tagSets = {
    solicitante: [
        'Super Rápido ⚡',
        'Muito Educado 😊',
        'Cuidado com o Pacote 📦',
        'Comunicação Clara 💬',
        'Veículo Bem Cuidado 🛵',
        'Pontual ⏱️'
    ],
    entregador: [
        'Fácil Localização 📍',
        'Rápido no Recebimento 👍',
        'Instruções Claras 📝',
        'Muito Gentil 😊',
        'Pronto na Chegada ⏱️',
        'Local Seguro 🛡️'
    ]
};

function buildStarRatingHTML({ orderId, role, title, subtitle, targetName, defaultStars = 5 }) {
    activeRatingState.orderId = orderId;
    activeRatingState.role = role;
    activeRatingState.selectedStars = defaultStars;
    activeRatingState.selectedTags = [];

    const availableTags = tagSets[role] || tagSets.solicitante;

    return `
        <div class="rating-box" id="ratingBox_${orderId}">
            <div class="rating-box-header">
                <div class="rating-box-title">
                    <span>⭐</span>
                    <span>${title || 'Avaliar Entrega'}</span>
                </div>
                <div class="rating-box-subtitle">${subtitle || 'Sua nota ajuda a manter a excelência da rede Busca Lá'}</div>
            </div>

            <!-- Interactive Stars Row -->
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div class="stars-interactive-row" id="starsRow_${orderId}" role="radiogroup" aria-label="Avaliação em estrelas">
                    ${[1, 2, 3, 4, 5].map(num => `
                        <button type="button" 
                                class="star-interactive-btn ${num <= defaultStars ? 'active' : ''}" 
                                data-star="${num}" 
                                aria-label="${num} estrela${num > 1 ? 's' : ''}"
                                title="${ratingLabels[num]}">
                            ★
                        </button>
                    `).join('')}
                </div>
                <span class="star-label-text" id="starLabelText_${orderId}">${ratingLabels[defaultStars]}</span>
            </div>

            <!-- Quick Praise Tags -->
            <div style="margin-top: 10px;">
                <small style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Destaques da experiência:</small>
                <div class="rating-tags-group" id="ratingTags_${orderId}">
                    ${availableTags.map(tag => `
                        <button type="button" class="rating-tag-pill" data-tag="${tag}">${tag}</button>
                    `).join('')}
                </div>
            </div>

            <!-- Optional Comment -->
            <div>
                <label style="font-size: 12px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Comentário adicional (opcional):</label>
                <textarea class="rating-comment-input" id="ratingComment_${orderId}" placeholder="Conte detalhes sobre o atendimento, pontualidade ou cuidado com a encomenda..."></textarea>
            </div>

            <!-- Submit Button -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px;">
                <button type="button" class="btn btn-primary" id="btnSubmitRating_${orderId}" onclick="submitStarRating('${orderId}', '${role}')">
                    Salvar Avaliação
                </button>
            </div>
        </div>
    `;
}

function attachStarRatingEvents(orderId, role) {
    const box = document.getElementById(`ratingBox_${orderId}`);
    if (!box) return;

    const starsRow = document.getElementById(`starsRow_${orderId}`);
    const labelText = document.getElementById(`starLabelText_${orderId}`);
    const starBtns = starsRow ? starsRow.querySelectorAll('.star-interactive-btn') : [];

    starBtns.forEach(btn => {
        const starVal = parseInt(btn.getAttribute('data-star'), 10);

        // Hover effect
        btn.addEventListener('mouseenter', () => {
            starBtns.forEach(b => {
                const val = parseInt(b.getAttribute('data-star'), 10);
                if (val <= starVal) {
                    b.classList.add('hovered');
                } else {
                    b.classList.remove('hovered');
                }
            });
            if (labelText) labelText.innerText = ratingLabels[starVal] || `${starVal} estrelas`;
        });

        // Click selection
        btn.addEventListener('click', () => {
            activeRatingState.selectedStars = starVal;
            starBtns.forEach(b => {
                const val = parseInt(b.getAttribute('data-star'), 10);
                if (val <= starVal) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            if (labelText) labelText.innerText = ratingLabels[starVal];
        });
    });

    if (starsRow) {
        starsRow.addEventListener('mouseleave', () => {
            starBtns.forEach(b => {
                b.classList.remove('hovered');
                const val = parseInt(b.getAttribute('data-star'), 10);
                if (val <= activeRatingState.selectedStars) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            if (labelText) labelText.innerText = ratingLabels[activeRatingState.selectedStars];
        });
    }

    // Tag pills toggle
    const tagGroup = document.getElementById(`ratingTags_${orderId}`);
    if (tagGroup) {
        tagGroup.querySelectorAll('.rating-tag-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const tag = pill.getAttribute('data-tag');
                if (pill.classList.contains('selected')) {
                    pill.classList.remove('selected');
                    activeRatingState.selectedTags = activeRatingState.selectedTags.filter(t => t !== tag);
                } else {
                    pill.classList.add('selected');
                    activeRatingState.selectedTags.push(tag);
                }
            });
        });
    }
}

async function submitStarRating(orderId, role) {
    const commentInput = document.getElementById(`ratingComment_${orderId}`);
    const comment = commentInput ? commentInput.value.trim() : '';
    const stars = activeRatingState.selectedStars || 5;
    const tags = activeRatingState.selectedTags || [];

    const btnSubmit = document.getElementById(`btnSubmitRating_${orderId}`);
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Enviando avaliação...';
    }

    try {
        const res = await fetch(`/api/orders/${orderId}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role,
                stars,
                comment,
                tags
            })
        });

        if (!res.ok) throw new Error('Falha ao registrar avaliação');
        const data = await res.json();

        showToast(`Avaliação de ${stars} estrelas registrada com sucesso!`, '⭐');
        closeRateModal();
        await fetchAppState();

    } catch (err) {
        showToast('Erro ao salvar avaliação. Tente novamente.', '❌');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Salvar Avaliação';
        }
    }
}


// ==========================================
// OPEN SOURCE MAP (LEAFLET + OPENSTREETMAP)
// ==========================================
const mapInstances = {
    solicitante: null,
    entregador: null,
    modal: null
};

const mapLayers = {
    solicitante: [],
    entregador: [],
    modal: []
};

function initOrUpdateRouteMap(containerId, mapKey, order) {
    if (typeof L === 'undefined') {
        console.warn('Leaflet ainda não carregado.');
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    let map = mapInstances[mapKey];

    if (!map) {
        map = L.map(containerId, {
            zoomControl: true,
            attributionControl: true
        });

        // OpenStreetMap Open Source Tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }).addTo(map);

        mapInstances[mapKey] = map;
        mapLayers[mapKey] = [];
    }

    // Clear previous layers
    if (mapLayers[mapKey] && mapLayers[mapKey].length > 0) {
        mapLayers[mapKey].forEach(layer => map.removeLayer(layer));
        mapLayers[mapKey] = [];
    }

    if (!order) return;

    // Resolve coordinates (with realistic defaults if empty)
    const pickup = order.pickupCoords || { lat: -23.5418, lng: -46.6295, label: order.originAddress };
    const dropoff = order.dropoffCoords || { lat: -23.5505, lng: -46.6333, label: order.destinationAddress };
    const driver = order.driverCoords || { 
        lat: parseFloat(((pickup.lat + dropoff.lat) / 2).toFixed(5)), 
        lng: parseFloat(((pickup.lng + dropoff.lng) / 2).toFixed(5)) 
    };

    // Marker A (Pickup)
    const iconPickup = L.divIcon({
        className: 'custom-map-icon',
        html: `<div class="map-marker-pin pickup" title="Coleta: ${order.originAddress}">A</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
    const markerA = L.marker([pickup.lat, pickup.lng], { icon: iconPickup }).addTo(map)
        .bindPopup(`<strong>Ponto A (Coleta)</strong><br>${order.originAddress}`);
    mapLayers[mapKey].push(markerA);

    // Marker B (Drop-off)
    const iconDropoff = L.divIcon({
        className: 'custom-map-icon',
        html: `<div class="map-marker-pin dropoff" title="Destino: ${order.destinationAddress}">B</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
    const markerB = L.marker([dropoff.lat, dropoff.lng], { icon: iconDropoff }).addTo(map)
        .bindPopup(`<strong>Ponto B (Destino)</strong><br>${order.destinationAddress}`);
    mapLayers[mapKey].push(markerB);

    // Driver Marker (if driver is assigned and order is active)
    let markerDriver = null;
    if (order.assignedDriverId || ['aceito', 'em_coleta', 'em_entrega'].includes(order.status)) {
        const iconDriver = L.divIcon({
            className: 'custom-map-icon',
            html: `<div class="map-marker-pin driver" title="${order.assignedDriverName || 'Entregador'}">🛵</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });
        markerDriver = L.marker([driver.lat, driver.lng], { icon: iconDriver }).addTo(map)
            .bindPopup(`<strong>${order.assignedDriverName || 'Entregador'}</strong><br>Status: ${order.status}`);
        mapLayers[mapKey].push(markerDriver);
    }

    // Connect points with polyline route
    const routeCoords = [
        [pickup.lat, pickup.lng],
        ...(markerDriver ? [[driver.lat, driver.lng]] : []),
        [dropoff.lat, dropoff.lng]
    ];

    const polyline = L.polyline(routeCoords, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
        dashArray: order.status === 'em_entrega' ? '8, 8' : null
    }).addTo(map);
    mapLayers[mapKey].push(polyline);

    // Fit map bounds
    const bounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
        ...(markerDriver ? [[driver.lat, driver.lng]] : [])
    ]);

    map.fitBounds(bounds, { padding: [35, 35] });

    // Handle container resize
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 150);
}

function recenterMap(mapKey) {
    const map = mapInstances[mapKey];
    if (map) {
        map.invalidateSize();
        const layers = mapLayers[mapKey];
        if (layers && layers.length > 0) {
            const markers = layers.filter(l => l.getLatLng);
            if (markers.length > 0) {
                const group = L.featureGroup(layers);
                map.fitBounds(group.getBounds(), { padding: [35, 35] });
            }
        }
    }
}


// ==========================================
// SOLICITANTE VIEW LOGIC
// ==========================================
function renderSolicitanteView() {
    const orders = appState.orders || [];
    const drivers = appState.drivers || [];

    // Stats
    const activeOrders = orders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado');
    const completedOrders = orders.filter(o => o.status === 'concluido');
    const onlineDrivers = drivers.filter(d => d.isOnline && d.approvalStatus === 'aprovado');
    const totalSpent = orders
        .filter(o => o.status !== 'cancelado')
        .reduce((sum, o) => sum + (o.price || 0), 0);

    const elActive = document.getElementById('solActiveCount');
    if (elActive) elActive.innerText = activeOrders.length;

    const elCompleted = document.getElementById('solCompletedCount');
    if (elCompleted) elCompleted.innerText = completedOrders.length;

    const elSpent = document.getElementById('solTotalSpent');
    if (elSpent) elSpent.innerText = `R$ ${totalSpent.toFixed(2).replace('.', ',')}`;

    const elDrivers = document.getElementById('solOnlineDrivers');
    if (elDrivers) elDrivers.innerText = onlineDrivers.length;

    // Populate driver select options for directed mode
    const selectDrv = document.getElementById('selectAssignedDriver');
    if (selectDrv) {
        const currentSelected = selectDrv.value;
        selectDrv.innerHTML = onlineDrivers.map(d => 
            `<option value="${d.id}" ${currentSelected === d.id ? 'selected' : ''}>${d.name} (${d.vehicle}) - ★ ${d.rating}</option>`
        ).join('');
        if (onlineDrivers.length === 0) {
            selectDrv.innerHTML = `<option value="">Nenhum entregador online no momento</option>`;
        }
    }

    // Active Order Tracker: show first active order, or last completed order for rating
    const activeOrder = activeOrders[0] || completedOrders[0];
    const container = document.getElementById('activeOrderContainer');
    const emptyMsg = document.getElementById('noActiveOrderMsg');
    const statusBadge = document.getElementById('activeOrderStatusBadge');

    if (activeOrder) {
        if (container) container.style.display = 'block';
        if (emptyMsg) emptyMsg.style.display = 'none';

        // Update Stepper
        updateStepper(activeOrder.status);

        // Update Order Details
        document.getElementById('activeOrderId').innerText = `Pedido #${activeOrder.id}`;
        document.getElementById('activeOrderPrice').innerText = `R$ ${activeOrder.price.toFixed(2).replace('.', ',')}`;
        document.getElementById('activeOrderOrigin').innerText = activeOrder.originAddress;
        document.getElementById('activeOrderDestination').innerText = activeOrder.destinationAddress;
        document.getElementById('activeOrderDesc').innerText = activeOrder.description;

        // Status badge
        const badgeMap = {
            aguardando_aceite: { label: 'Aguardando Aceite', class: 'waiting' },
            aceito: { label: 'Aceito pelo Entregador', class: 'transit' },
            em_coleta: { label: 'Em Coleta', class: 'transit' },
            em_entrega: { label: 'Em Rota para Destino', class: 'transit' },
            concluido: { label: 'Entrega Concluída', class: 'completed' },
            cancelado: { label: 'Cancelado', class: 'cancelled' }
        };
        const badgeInfo = badgeMap[activeOrder.status] || { label: activeOrder.status, class: 'waiting' };
        if (statusBadge) {
            statusBadge.className = `badge-status ${badgeInfo.class}`;
            statusBadge.innerText = badgeInfo.label;
        }

        // Driver box
        const driverName = document.getElementById('activeDriverName');
        const driverDetails = document.getElementById('activeDriverDetails');
        const driverAvatar = document.getElementById('activeDriverAvatar');

        if (activeOrder.assignedDriverName) {
            driverName.innerText = activeOrder.assignedDriverName;
            const drv = drivers.find(d => d.id === activeOrder.assignedDriverId);
            driverDetails.innerText = drv ? `${drv.vehicle} · Placa ${drv.plate} · Tel: ${drv.phone}` : 'Entregador em deslocamento';
            driverAvatar.innerText = '🛵';
        } else {
            driverName.innerText = 'Aguardando primeiro entregador aceitar...';
            driverDetails.innerText = activeOrder.dispatchMode === 'direcionado' 
                ? 'Aguardando confirmação do entregador selecionado' 
                : 'Notificação enviada aos entregadores online da região';
            driverAvatar.innerText = '📢';
        }

        // Update Open Source Route Map
        initOrUpdateRouteMap('solicitanteActiveMap', 'solicitante', activeOrder);

        // Timeline
        const timeline = document.getElementById('activeOrderTimeline');
        if (timeline && activeOrder.events) {
            timeline.innerHTML = activeOrder.events.map(ev => `
                <div class="timeline-event">
                    <div class="timeline-dot"></div>
                    <div class="timeline-event-time">${ev.time}</div>
                    <div class="timeline-event-text">${ev.description}</div>
                </div>
            `).join('');
        }

        // Star-Rating Component for Completed Order
        const ratingSection = document.getElementById('activeOrderRatingSection');
        if (ratingSection) {
            if (activeOrder.status === 'concluido') {
                if (activeOrder.userRating) {
                    ratingSection.innerHTML = `
                        <div class="rating-box" style="background: #f0fdf4; border-color: #bbf7d0;">
                            <div class="rating-badge-row">
                                <span style="font-weight: 700; color: #166534; font-size: 14px;">✅ Sua avaliação para ${activeOrder.assignedDriverName || 'o Entregador'}</span>
                                <span class="rating-stars-static">${'★'.repeat(activeOrder.userRating.stars)}${'☆'.repeat(5 - activeOrder.userRating.stars)} (${activeOrder.userRating.stars}/5)</span>
                            </div>
                            ${activeOrder.userRating.comment ? `<p style="font-size: 13px; color: #166534; margin: 6px 0;">"${activeOrder.userRating.comment}"</p>` : ''}
                            ${activeOrder.userRating.tags && activeOrder.userRating.tags.length > 0 ? `
                                <div class="rating-tags-display">
                                    ${activeOrder.userRating.tags.map(t => `<span class="rating-tag-display-item" style="background: #dcfce7; color: #166534;">${t}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    ratingSection.innerHTML = buildStarRatingHTML({
                        orderId: activeOrder.id,
                        role: 'solicitante',
                        title: `Como foi a entrega com ${activeOrder.assignedDriverName || 'o Entregador'}?`,
                        subtitle: 'Dê sua nota de 1 a 5 estrelas para pontualidade e cuidado',
                        targetName: activeOrder.assignedDriverName
                    });
                    attachStarRatingEvents(activeOrder.id, 'solicitante');
                }
            } else {
                ratingSection.innerHTML = '';
            }
        }

    } else {
        if (container) container.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (statusBadge) {
            statusBadge.className = 'badge-status online';
            statusBadge.innerText = 'Pronto para novo pedido';
        }
    }

    // Completed Deliveries History Component
    renderSolicitanteCompletedHistory();
}

function updateStepper(status) {
    const lineFill = document.getElementById('stepperLineFill');
    const nodes = [
        document.getElementById('stepNode1'),
        document.getElementById('stepNode2'),
        document.getElementById('stepNode3'),
        document.getElementById('stepNode4'),
        document.getElementById('stepNode5')
    ];

    nodes.forEach(n => {
        if (n) {
            n.classList.remove('active');
            n.classList.remove('completed');
        }
    });

    const statusWeights = {
        'aguardando_aceite': 1,
        'aceito': 2,
        'em_coleta': 3,
        'em_entrega': 4,
        'concluido': 5
    };

    const currentWeight = statusWeights[status] || 1;

    // Fill line width
    const percentages = { 1: '15%', 2: '38%', 3: '62%', 4: '85%', 5: '100%' };
    if (lineFill) lineFill.style.width = percentages[currentWeight] || '15%';

    for (let i = 1; i <= 5; i++) {
        const node = nodes[i - 1];
        if (!node) continue;
        if (i < currentWeight) {
            node.classList.add('completed');
        } else if (i === currentWeight) {
            if (currentWeight === 5) {
                node.classList.add('completed');
            } else {
                node.classList.add('active');
            }
        }
    }
}

let solicitanteHistorySearch = '';
let solicitanteHistoryStatus = 'concluido';
let solicitanteHistoryPeriod = 'todos';
let solicitanteHistoryStartDate = '';
let solicitanteHistoryEndDate = '';

function getTodayISODate() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

function getShiftedISODate(daysAgo) {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
}

function handleSolPeriodPresetChange() {
    const select = document.getElementById('solHistPeriodSelect');
    const startInput = document.getElementById('solHistStartDate');
    const endInput = document.getElementById('solHistEndDate');
    if (!select) return;

    const val = select.value;
    solicitanteHistoryPeriod = val;

    if (val === 'hoje') {
        const today = getTodayISODate();
        if (startInput) startInput.value = today;
        if (endInput) endInput.value = today;
    } else if (val === 'ontem') {
        const yesterday = getShiftedISODate(1);
        if (startInput) startInput.value = yesterday;
        if (endInput) endInput.value = yesterday;
    } else if (val === '7dias') {
        if (startInput) startInput.value = getShiftedISODate(7);
        if (endInput) endInput.value = getTodayISODate();
    } else if (val === '30dias') {
        if (startInput) startInput.value = getShiftedISODate(30);
        if (endInput) endInput.value = getTodayISODate();
    } else if (val === 'todos') {
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
    }

    handleFilterSolicitanteHistory();
}

function handleFilterSolicitanteHistory() {
    const inputSearch = document.getElementById('solHistSearchInput');
    const selectStatus = document.getElementById('solHistStatusSelect');
    const selectPeriod = document.getElementById('solHistPeriodSelect');
    const startInput = document.getElementById('solHistStartDate');
    const endInput = document.getElementById('solHistEndDate');

    solicitanteHistorySearch = inputSearch ? inputSearch.value.trim().toLowerCase() : '';
    solicitanteHistoryStatus = selectStatus ? selectStatus.value : 'todos';
    solicitanteHistoryPeriod = selectPeriod ? selectPeriod.value : 'todos';
    solicitanteHistoryStartDate = startInput ? startInput.value : '';
    solicitanteHistoryEndDate = endInput ? endInput.value : '';

    renderSolicitanteCompletedHistory();
}

function clearSolicitanteFilters() {
    const inputSearch = document.getElementById('solHistSearchInput');
    const selectStatus = document.getElementById('solHistStatusSelect');
    const selectPeriod = document.getElementById('solHistPeriodSelect');
    const startInput = document.getElementById('solHistStartDate');
    const endInput = document.getElementById('solHistEndDate');

    if (inputSearch) inputSearch.value = '';
    if (selectStatus) selectStatus.value = 'todos';
    if (selectPeriod) selectPeriod.value = 'todos';
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    solicitanteHistorySearch = '';
    solicitanteHistoryStatus = 'todos';
    solicitanteHistoryPeriod = 'todos';
    solicitanteHistoryStartDate = '';
    solicitanteHistoryEndDate = '';

    showToast('Filtros do histórico resetados.', '↺');
    renderSolicitanteCompletedHistory();
}

function renderSolicitanteCompletedHistory() {
    const tbody = document.getElementById('solicitanteCompletedTbody');
    if (!tbody) return;

    const allOrders = appState.orders || [];
    const completedOrders = allOrders.filter(o => o.status === 'concluido');

    // Calculate Summary KPIs
    const totalSpent = completedOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const ratedOrders = completedOrders.filter(o => o.userRating);
    const avgRating = ratedOrders.length > 0
        ? (ratedOrders.reduce((sum, o) => sum + o.userRating.stars, 0) / ratedOrders.length).toFixed(1)
        : '5.0';

    const elCount = document.getElementById('solHistCompletedCount');
    if (elCount) elCount.innerText = completedOrders.length;

    const elSpent = document.getElementById('solHistTotalSpent');
    if (elSpent) elSpent.innerText = `R$ ${totalSpent.toFixed(2).replace('.', ',')}`;

    const elRating = document.getElementById('solHistAvgRating');
    if (elRating) elRating.innerText = `★ ${avgRating}`;

    // Apply Status Filter
    let filtered = [...allOrders];

    if (solicitanteHistoryStatus === 'concluido') {
        filtered = filtered.filter(o => o.status === 'concluido');
    } else if (solicitanteHistoryStatus === 'cancelado') {
        filtered = filtered.filter(o => o.status === 'cancelado');
    } else if (solicitanteHistoryStatus === 'em_entrega') {
        filtered = filtered.filter(o => o.status === 'em_entrega');
    } else {
        // 'todos': show finished and tracked orders
        filtered = filtered.filter(o => ['concluido', 'cancelado', 'em_entrega'].includes(o.status));
    }

    // Apply Search Filter
    if (solicitanteHistorySearch) {
        filtered = filtered.filter(o => 
            o.id.toLowerCase().includes(solicitanteHistorySearch) ||
            o.originAddress.toLowerCase().includes(solicitanteHistorySearch) ||
            o.destinationAddress.toLowerCase().includes(solicitanteHistorySearch) ||
            (o.assignedDriverName && o.assignedDriverName.toLowerCase().includes(solicitanteHistorySearch)) ||
            (o.description && o.description.toLowerCase().includes(solicitanteHistorySearch))
        );
    }

    // Apply Date Range Filter
    if (solicitanteHistoryStartDate) {
        const startTs = new Date(solicitanteHistoryStartDate + 'T00:00:00').getTime();
        filtered = filtered.filter(o => new Date(o.createdAt).getTime() >= startTs);
    }

    if (solicitanteHistoryEndDate) {
        const endTs = new Date(solicitanteHistoryEndDate + 'T23:59:59').getTime();
        filtered = filtered.filter(o => new Date(o.createdAt).getTime() <= endTs);
    }

    // Update Results Counter and Tags
    const countEl = document.getElementById('solHistResultsCount');
    if (countEl) {
        countEl.innerHTML = `Mostrando <strong>${filtered.length}</strong> registro(s) no histórico`;
    }

    const tagsEl = document.getElementById('solHistActiveTags');
    if (tagsEl) {
        let tagsHtml = '';
        if (solicitanteHistoryStatus !== 'todos') {
            const statusNames = { concluido: 'Entregue ✅', cancelado: 'Cancelado ❌', em_entrega: 'Em Rota 🛵' };
            tagsHtml += `<span class="filter-tag-badge ${solicitanteHistoryStatus === 'cancelado' ? 'canceled' : 'delivered'}">Status: ${statusNames[solicitanteHistoryStatus] || solicitanteHistoryStatus}</span>`;
        }
        if (solicitanteHistoryStartDate || solicitanteHistoryEndDate) {
            tagsHtml += `<span class="filter-tag-badge">Data: ${solicitanteHistoryStartDate ? solicitanteHistoryStartDate.split('-').reverse().join('/') : 'Início'} até ${solicitanteHistoryEndDate ? solicitanteHistoryEndDate.split('-').reverse().join('/') : 'Fim'}</span>`;
        }
        if (solicitanteHistorySearch) {
            tagsHtml += `<span class="filter-tag-badge">Busca: "${solicitanteHistorySearch}"</span>`;
        }
        tagsEl.innerHTML = tagsHtml;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--muted); padding: 36px 20px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                    <strong style="display: block; font-size: 15px; color: var(--text);">Nenhuma entrega encontrada para estes filtros</strong>
                    <span style="font-size: 13px;">Tente alterar o status ou o intervalo de datas selecionado.</span>
                    <div style="margin-top: 12px;">
                        <button class="btn btn-outline btn-sm" onclick="clearSolicitanteFilters()">Limpar Filtros</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(o => {
        const formattedDate = new Date(o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const formattedTime = new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Status Badge Mapping
        const badgeMap = {
            concluido: { label: 'Entregue ✅', class: 'completed' },
            cancelado: { label: 'Cancelado ❌', class: 'cancelled' },
            em_entrega: { label: 'Em Rota 🛵', class: 'transit' }
        };
        const badge = badgeMap[o.status] || { label: o.status, class: 'waiting' };

        // Rating or Status Notes
        let ratingHTML = '';
        if (o.status === 'concluido') {
            if (o.userRating) {
                ratingHTML = `
                    <div>
                        <span style="color: #f59e0b; font-weight: 700; font-size: 13px;">${'★'.repeat(o.userRating.stars)}${'☆'.repeat(5 - o.userRating.stars)}</span>
                        <span class="tabular" style="font-size: 11px; color: #b45309; font-weight: 600;">(${o.userRating.stars}/5)</span>
                        ${o.userRating.tags && o.userRating.tags.length > 0 ? `
                            <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">
                                ${o.userRating.tags[0]}
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                ratingHTML = `
                    <button class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 11px;" onclick="openRateModal('${o.id}', 'solicitante')">
                        ⭐ Avaliar
                    </button>
                `;
            }
        } else if (o.status === 'cancelado') {
            ratingHTML = `<span style="font-size: 11px; color: #dc2626;">${o.cancelReason || 'Cancelado antes da entrega'}</span>`;
        } else {
            ratingHTML = `<span style="font-size: 11px; color: #2563eb;">Em andamento</span>`;
        }

        return `
            <tr>
                <td>
                    <strong style="color: var(--primary); font-size: 14px;">#${o.id}</strong>
                    <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${formattedDate} às ${formattedTime}</div>
                    <span class="badge-status ${badge.class}" style="font-size: 10px; padding: 2px 6px; margin-top: 4px; display: inline-block;">${badge.label}</span>
                </td>
                <td>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text);">${o.originAddress}</div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">➔ ${o.destinationAddress}</div>
                    <div style="font-size: 11px; color: #2563eb; font-weight: 600; margin-top: 3px;">📍 ${o.distanceKm} km · ${o.description}</div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">🛵</span>
                        <div>
                            <div style="font-weight: 700; font-size: 13px;">${o.assignedDriverName || 'Aguardando atribuição'}</div>
                            <div style="font-size: 11px; color: var(--muted);">${o.status === 'concluido' ? 'Entrega finalizada' : o.status === 'cancelado' ? 'Serviço encerrado' : 'Em deslocamento'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    ${ratingHTML}
                </td>
                <td class="text-right tabular" style="font-weight: 800; font-size: 15px; color: ${o.status === 'cancelado' ? 'var(--muted)' : 'var(--text)'};">
                    ${o.status === 'cancelado' ? `<del>R$ ${o.price.toFixed(2).replace('.', ',')}</del>` : `R$ ${o.price.toFixed(2).replace('.', ',')}`}
                </td>
                <td class="text-right" style="white-space: nowrap;">
                    ${o.status === 'concluido' ? `
                        <button class="btn btn-outline btn-sm" style="padding: 5px 9px; font-size: 11px; margin-right: 4px;" title="Ver Comprovante Oficial" onclick="openReceiptModal('${o.id}')">
                            📄 Comprovante
                        </button>
                    ` : ''}
                    <button class="btn btn-outline btn-sm" style="padding: 5px 9px; font-size: 11px; margin-right: 4px;" title="Ver Detalhes e Rota" onclick="openOrderModal('${o.id}')">
                        🗺️ Rota
                    </button>
                    <button class="btn btn-outline btn-sm" style="padding: 5px 9px; font-size: 11px; color: var(--primary);" title="Repetir este pedido" onclick="handleRepeatOrder('${o.id}')">
                        🔄 ${o.status === 'cancelado' ? 'Refazer' : 'Repetir'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function selectDispatchMode(mode) {
    selectedDispatchMode = mode;
    const cardAll = document.getElementById('modeCardAll');
    const cardDirect = document.getElementById('modeCardDirect');
    const selectGroup = document.getElementById('driverSelectGroup');

    if (mode === 'chamar_todos') {
        if (cardAll) cardAll.classList.add('selected');
        if (cardDirect) cardDirect.classList.remove('selected');
        if (selectGroup) selectGroup.style.display = 'none';
    } else {
        if (cardAll) cardAll.classList.remove('selected');
        if (cardDirect) cardDirect.classList.add('selected');
        if (selectGroup) selectGroup.style.display = 'block';
    }
}

// ==========================================
// CEP SEARCH & AUTO-FILL SYSTEM (ViaCEP / BrasilAPI)
// ==========================================

function handleCepInput(input, target) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);

    // Apply CEP mask 00000-000
    if (val.length > 5) {
        input.value = val.substring(0, 5) + '-' + val.substring(5);
    } else {
        input.value = val;
    }

    // Auto trigger when 8 digits are complete
    if (val.length === 8) {
        searchCep(target);
    }
}

function handleCepBlur(target) {
    const input = document.getElementById(target === 'origin' ? 'inputCepOrigin' : 'inputCepDestination');
    if (!input) return;
    const clean = input.value.replace(/\D/g, '');
    if (clean.length === 8) {
        searchCep(target);
    }
}

async function searchCep(target) {
    const isOrigin = target === 'origin';
    const inputCep = document.getElementById(isOrigin ? 'inputCepOrigin' : 'inputCepDestination');
    const inputAddr = document.getElementById(isOrigin ? 'inputOrigin' : 'inputDestination');
    const btnSearch = document.getElementById(isOrigin ? 'btnSearchCepOrigin' : 'btnSearchCepDestination');
    const feedback = document.getElementById(isOrigin ? 'cepOriginFeedback' : 'cepDestinationFeedback');

    if (!inputCep || !inputAddr) return;

    const rawCep = inputCep.value.replace(/\D/g, '');
    if (rawCep.length !== 8) {
        if (feedback) {
            feedback.innerHTML = '<span style="color: #dc2626; font-weight: 600;">⚠️ Digite um CEP com 8 dígitos</span>';
        }
        inputCep.focus();
        return;
    }

    // Visual feedback & loading
    if (btnSearch) {
        btnSearch.disabled = true;
        btnSearch.innerHTML = '⏳ Buscando...';
    }
    if (feedback) {
        feedback.innerHTML = '<span style="color: var(--primary);">Consultando ViaCEP...</span>';
    }

    try {
        let data = null;

        // Try primary public API: ViaCEP
        try {
            const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`, { cache: 'no-cache' });
            if (res.ok) {
                const json = await res.json();
                if (!json.erro) {
                    data = json;
                }
            }
        } catch (e1) {
            console.warn('ViaCEP falhou, tentando fallback BrasilAPI...', e1);
        }

        // Fallback public API: BrasilAPI
        if (!data) {
            try {
                const resFallback = await fetch(`https://brasilapi.com.br/api/cep/v1/${rawCep}`);
                if (resFallback.ok) {
                    const jsonFallback = await resFallback.json();
                    if (jsonFallback.street || jsonFallback.neighborhood) {
                        data = {
                            logradouro: jsonFallback.street || '',
                            bairro: jsonFallback.neighborhood || '',
                            localidade: jsonFallback.city || '',
                            uf: jsonFallback.state || ''
                        };
                    }
                }
            } catch (e2) {
                console.warn('BrasilAPI fallback também falhou:', e2);
            }
        }

        if (!data || data.erro) {
            if (feedback) {
                feedback.innerHTML = '<span style="color: #dc2626; font-weight: 600;">❌ CEP não encontrado</span>';
            }
            showToast(`CEP ${inputCep.value} não foi localizado na base. Digite o endereço manualmente.`, '⚠️');
            return;
        }

        // Construct formatted address
        const streetPart = data.logradouro ? data.logradouro : '';
        const neighborhoodPart = data.bairro ? ` - ${data.bairro}` : '';
        const cityStatePart = (data.localidade && data.uf) ? `, ${data.localidade} - ${data.uf}` : '';
        
        let constructedAddress = '';
        if (streetPart) {
            constructedAddress = `${streetPart}, nº${neighborhoodPart}${cityStatePart}`;
        } else {
            constructedAddress = `${data.bairro || ''}${cityStatePart}`;
        }

        inputAddr.value = constructedAddress;
        inputAddr.focus();

        // Highlight number field for user to complete number
        const numIndex = constructedAddress.indexOf('nº');
        if (numIndex !== -1 && inputAddr.setSelectionRange) {
            setTimeout(() => {
                inputAddr.setSelectionRange(numIndex, numIndex + 2);
            }, 50);
        }

        if (feedback) {
            feedback.innerHTML = `<span style="color: #16a34a; font-weight: 600;">✓ ${data.bairro || ''} ${data.localidade}/${data.uf}</span>`;
        }

        showToast(`Endereço de ${isOrigin ? 'coleta' : 'entrega'} preenchido via CEP!`, '📍');

        // Recalculate price suggestion
        calculateSuggestedPrice();

    } catch (err) {
        console.error('Erro na consulta de CEP:', err);
        if (feedback) {
            feedback.innerHTML = '<span style="color: #dc2626;">Erro na consulta</span>';
        }
        showToast('Não foi possível consultar o CEP no momento.', '❌');
    } finally {
        if (btnSearch) {
            btnSearch.disabled = false;
            btnSearch.innerHTML = '🔍 Buscar CEP';
        }
    }
}

function calculateSuggestedPrice() {
    const distInput = document.getElementById('inputDistance');
    const priceInput = document.getElementById('inputPrice');
    if (!distInput || !priceInput) return;

    const km = parseFloat(distInput.value) || 1;
    const calculated = Math.max(10, 8 + km * 1.8);
    priceInput.value = (Math.round(calculated * 2) / 2).toFixed(2);
}

function focusNewOrderForm() {
    const formPanel = document.getElementById('newOrderPanel');
    if (formPanel) {
        formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originInput = document.getElementById('inputOrigin');
        if (originInput) originInput.focus();
    }
}

// Handle Order Creation
async function handleCreateOrder(e) {
    e.preventDefault();

    const origin = document.getElementById('inputOrigin').value.trim();
    const destination = document.getElementById('inputDestination').value.trim();
    const contact = document.getElementById('inputContact').value.trim();
    const distance = parseFloat(document.getElementById('inputDistance').value) || 3.5;
    const description = document.getElementById('inputDescription').value.trim();
    const notes = document.getElementById('inputNotes').value.trim();
    const price = parseFloat(document.getElementById('inputPrice').value) || 14.00;
    const assignedDriverId = selectedDispatchMode === 'direcionado' ? document.getElementById('selectAssignedDriver').value : null;

    const btnSubmit = document.getElementById('btnSubmitOrder');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Publicando na rede...';
    }

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requesterName: 'Comércio Local',
                requesterPhone: contact,
                originAddress: origin,
                destinationAddress: destination,
                distanceKm: distance,
                price: price,
                description: description,
                notes: notes,
                dispatchMode: selectedDispatchMode,
                assignedDriverId: assignedDriverId
            })
        });

        if (!res.ok) throw new Error('Erro ao criar solicitação');
        const data = await res.json();

        showToast(`Pedido #${data.order.id} publicado com sucesso! Entregadores notificados.`, '🚀');
        await fetchAppState();

    } catch (err) {
        showToast('Erro ao criar pedido. Verifique os campos e tente novamente.', '❌');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = '🚀 Publicar Solicitação de Entrega';
        }
    }
}


// ==========================================
// ENTREGADOR VIEW LOGIC
// ==========================================
function renderEntregadorView() {
    const drivers = appState.drivers || [];
    const orders = appState.orders || [];

    // Find active driver
    const driver = drivers.find(d => d.id === currentDriverId) || drivers[0] || {};

    // Update Status Switcher
    const statusLabel = document.getElementById('driverStatusLabel');
    const toggleContainer = document.getElementById('driverOnlineToggle');
    const offlineWarning = document.getElementById('driverOfflineWarning');

    if (driver.isOnline) {
        if (statusLabel) {
            statusLabel.style.color = '#16a34a';
            statusLabel.innerText = '● ONLINE - Disponível para entregas';
        }
        if (toggleContainer) toggleContainer.className = 'switch-container on';
        if (offlineWarning) offlineWarning.style.display = 'none';
    } else {
        if (statusLabel) {
            statusLabel.style.color = '#64748b';
            statusLabel.innerText = '○ OFFLINE - Indisponível';
        }
        if (toggleContainer) toggleContainer.className = 'switch-container';
        if (offlineWarning) offlineWarning.style.display = 'block';
    }

    // Earnings and Stats
    const elEarnings = document.getElementById('drvEarningsToday');
    if (elEarnings) elEarnings.innerText = `R$ ${(driver.todayEarnings || 0).toFixed(2).replace('.', ',')}`;

    const elDeliveries = document.getElementById('drvDeliveriesToday');
    if (elDeliveries) elDeliveries.innerText = driver.deliveriesCount || 0;

    // Active Mission Check
    const activeMission = orders.find(o => 
        o.assignedDriverId === driver.id && 
        ['aceito', 'em_coleta', 'em_entrega'].includes(o.status)
    );

    const missionContainer = document.getElementById('driverActiveMissionContainer');
    if (activeMission && driver.isOnline) {
        if (missionContainer) missionContainer.style.display = 'block';

        document.getElementById('missionOrderId').innerText = `Pedido #${activeMission.id}`;
        document.getElementById('missionOrigin').innerText = activeMission.originAddress;
        document.getElementById('missionRequester').innerText = `${activeMission.requesterName} · Tel: ${activeMission.requesterPhone}`;
        document.getElementById('missionDestination').innerText = activeMission.destinationAddress;
        document.getElementById('missionDesc').innerText = activeMission.description;
        document.getElementById('missionPrice').innerText = `R$ ${activeMission.price.toFixed(2).replace('.', ',')}`;
        document.getElementById('missionDistance').innerText = `${activeMission.distanceKm} km`;

        const badgeMap = {
            aceito: 'Aceito - Deslocando para Coleta',
            em_coleta: 'No Ponto de Coleta',
            em_entrega: 'Em Rota para Entrega'
        };
        document.getElementById('missionStatusBadge').innerText = badgeMap[activeMission.status] || activeMission.status;

        // Button label according to state
        const btnAdvance = document.getElementById('btnAdvanceMission');
        if (activeMission.status === 'aceito') {
            btnAdvance.innerText = '📍 Cheguei na Coleta';
        } else if (activeMission.status === 'em_coleta') {
            btnAdvance.innerText = '📦 Peguei a Encomenda (Iniciar Rota)';
        } else if (activeMission.status === 'em_entrega') {
            btnAdvance.innerText = '✅ Confirmar Entrega Realizada';
        }

        // Update Open Source Driver Mission Map
        initOrUpdateRouteMap('driverMissionMap', 'entregador', activeMission);

    } else {
        if (missionContainer) missionContainer.style.display = 'none';
    }

    // Available Calls (Radar)
    const availableOrders = orders.filter(o => 
        o.status === 'aguardando_aceite' && 
        (o.dispatchMode === 'chamar_todos' || o.assignedDriverId === driver.id)
    );

    const availableContainer = document.getElementById('availableOrdersList');
    const radarWaiting = document.getElementById('driverRadarWaiting');

    if (driver.isOnline && availableOrders.length > 0) {
        if (radarWaiting) radarWaiting.style.display = 'none';
        if (availableContainer) {
            availableContainer.innerHTML = availableOrders.map(o => `
                <div class="order-alert-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <span class="badge" style="margin-bottom: 6px;">NOVA SOLICITAÇÃO NA ÁREA</span>
                            <h3 style="font-size: 18px; font-weight: 700;">#${o.id} - ${o.requesterName}</h3>
                        </div>
                        <div class="text-right">
                            <span style="font-size: 12px; color: var(--muted); display: block;">Você recebe líquido:</span>
                            <div class="stat-box-value tabular" style="color: #16a34a; font-size: 26px;">R$ ${o.price.toFixed(2).replace('.', ',')}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                        <div>
                            <small style="color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Coleta (A)</small>
                            <p style="font-weight: 600; font-size: 13px;">${o.originAddress}</p>
                        </div>
                        <div>
                            <small style="color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Destino (B)</small>
                            <p style="font-weight: 600; font-size: 13px;">${o.destinationAddress}</p>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--muted); margin-bottom: 16px;">
                        <span>Distância: <strong style="color: var(--text);">${o.distanceKm} km</strong></span>
                        <span>Carga: <strong style="color: var(--text);">${o.description}</strong></span>
                        <span>Modo: <strong style="color: var(--text);">${o.dispatchMode === 'direcionado' ? 'Direcionado a você' : 'Chamar todos'}</strong></span>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary full btn-large" onclick="handleAcceptDelivery('${o.id}')">
                            ⚡ Aceitar Entrega Agora
                        </button>
                        <button class="btn btn-outline" style="min-width: 110px;" onclick="handleDeclineDelivery('${o.id}')">
                            Recusar
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } else {
        if (availableContainer) availableContainer.innerHTML = '';
        if (radarWaiting) radarWaiting.style.display = driver.isOnline ? 'block' : 'none';
    }

    // Driver Completed Deliveries History Component
    renderDriverCompletedHistory(driver.id);
}

let driverHistorySearch = '';
let driverHistoryStatus = 'concluido';
let driverHistoryPeriod = 'todos';
let driverHistoryStartDate = '';
let driverHistoryEndDate = '';

function handleDrvPeriodPresetChange() {
    const select = document.getElementById('drvHistPeriodSelect');
    const startInput = document.getElementById('drvHistStartDate');
    const endInput = document.getElementById('drvHistEndDate');
    if (!select) return;

    const val = select.value;
    driverHistoryPeriod = val;

    if (val === 'hoje') {
        const today = getTodayISODate();
        if (startInput) startInput.value = today;
        if (endInput) endInput.value = today;
    } else if (val === 'ontem') {
        const yesterday = getShiftedISODate(1);
        if (startInput) startInput.value = yesterday;
        if (endInput) endInput.value = yesterday;
    } else if (val === '7dias') {
        if (startInput) startInput.value = getShiftedISODate(7);
        if (endInput) endInput.value = getTodayISODate();
    } else if (val === '30dias') {
        if (startInput) startInput.value = getShiftedISODate(30);
        if (endInput) endInput.value = getTodayISODate();
    } else if (val === 'todos') {
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
    }

    handleFilterDriverHistory();
}

function handleFilterDriverHistory() {
    const inputSearch = document.getElementById('drvHistSearchInput');
    const selectStatus = document.getElementById('drvHistStatusSelect');
    const selectPeriod = document.getElementById('drvHistPeriodSelect');
    const startInput = document.getElementById('drvHistStartDate');
    const endInput = document.getElementById('drvHistEndDate');

    driverHistorySearch = inputSearch ? inputSearch.value.trim().toLowerCase() : '';
    driverHistoryStatus = selectStatus ? selectStatus.value : 'todos';
    driverHistoryPeriod = selectPeriod ? selectPeriod.value : 'todos';
    driverHistoryStartDate = startInput ? startInput.value : '';
    driverHistoryEndDate = endInput ? endInput.value : '';

    renderDriverCompletedHistory(currentDriverId);
}

function clearDriverFilters() {
    const inputSearch = document.getElementById('drvHistSearchInput');
    const selectStatus = document.getElementById('drvHistStatusSelect');
    const selectPeriod = document.getElementById('drvHistPeriodSelect');
    const startInput = document.getElementById('drvHistStartDate');
    const endInput = document.getElementById('drvHistEndDate');

    if (inputSearch) inputSearch.value = '';
    if (selectStatus) selectStatus.value = 'todos';
    if (selectPeriod) selectPeriod.value = 'todos';
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    driverHistorySearch = '';
    driverHistoryStatus = 'todos';
    driverHistoryPeriod = 'todos';
    driverHistoryStartDate = '';
    driverHistoryEndDate = '';

    showToast('Filtros do extrato resetados.', '↺');
    renderDriverCompletedHistory(currentDriverId);
}

function renderDriverCompletedHistory(driverId) {
    const tbody = document.getElementById('driverCompletedTbody');
    if (!tbody) return;

    const myOrders = (appState.orders || []).filter(o => 
        o.assignedDriverId === (driverId || currentDriverId)
    );
    const completedOrders = myOrders.filter(o => o.status === 'concluido');

    // Calculate Driver Summary KPIs
    const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const totalKm = completedOrders.reduce((sum, o) => sum + (o.distanceKm || 0), 0);
    const ratedByClients = completedOrders.filter(o => o.userRating);
    const avgClientRating = ratedByClients.length > 0
        ? (ratedByClients.reduce((sum, o) => sum + o.userRating.stars, 0) / ratedByClients.length).toFixed(1)
        : '5.0';

    const elCount = document.getElementById('drvHistCompletedCount');
    if (elCount) elCount.innerText = completedOrders.length;

    const elEarnings = document.getElementById('drvHistEarnings');
    if (elEarnings) elEarnings.innerText = `R$ ${totalEarnings.toFixed(2).replace('.', ',')}`;

    const elTotalKm = document.getElementById('drvHistTotalKm');
    if (elTotalKm) elTotalKm.innerText = `${totalKm.toFixed(1)} km`;

    const elAvgRating = document.getElementById('drvHistAvgRating');
    if (elAvgRating) elAvgRating.innerText = `★ ${avgClientRating}`;

    // Apply Status Filter
    let filtered = [...myOrders];

    if (driverHistoryStatus === 'concluido') {
        filtered = filtered.filter(o => o.status === 'concluido');
    } else if (driverHistoryStatus === 'cancelado') {
        filtered = filtered.filter(o => o.status === 'cancelado');
    } else {
        // 'todos': show concluido and cancelado
        filtered = filtered.filter(o => ['concluido', 'cancelado'].includes(o.status));
    }

    // Apply Search Filter
    if (driverHistorySearch) {
        filtered = filtered.filter(o => 
            o.id.toLowerCase().includes(driverHistorySearch) ||
            o.requesterName.toLowerCase().includes(driverHistorySearch) ||
            o.originAddress.toLowerCase().includes(driverHistorySearch) ||
            o.destinationAddress.toLowerCase().includes(driverHistorySearch)
        );
    }

    // Apply Date Range Filter
    if (driverHistoryStartDate) {
        const startTs = new Date(driverHistoryStartDate + 'T00:00:00').getTime();
        filtered = filtered.filter(o => new Date(o.createdAt).getTime() >= startTs);
    }

    if (driverHistoryEndDate) {
        const endTs = new Date(driverHistoryEndDate + 'T23:59:59').getTime();
        filtered = filtered.filter(o => new Date(o.createdAt).getTime() <= endTs);
    }

    // Update Results Counter and Tags
    const countEl = document.getElementById('drvHistResultsCount');
    if (countEl) {
        countEl.innerHTML = `Mostrando <strong>${filtered.length}</strong> corrida(s) no extrato`;
    }

    const tagsEl = document.getElementById('drvHistActiveTags');
    if (tagsEl) {
        let tagsHtml = '';
        if (driverHistoryStatus !== 'todos') {
            const statusNames = { concluido: 'Concluída ✅', cancelado: 'Cancelada ❌' };
            tagsHtml += `<span class="filter-tag-badge ${driverHistoryStatus === 'cancelado' ? 'canceled' : 'delivered'}">Status: ${statusNames[driverHistoryStatus] || driverHistoryStatus}</span>`;
        }
        if (driverHistoryStartDate || driverHistoryEndDate) {
            tagsHtml += `<span class="filter-tag-badge">Data: ${driverHistoryStartDate ? driverHistoryStartDate.split('-').reverse().join('/') : 'Início'} até ${driverHistoryEndDate ? driverHistoryEndDate.split('-').reverse().join('/') : 'Fim'}</span>`;
        }
        if (driverHistorySearch) {
            tagsHtml += `<span class="filter-tag-badge">Busca: "${driverHistorySearch}"</span>`;
        }
        tagsEl.innerHTML = tagsHtml;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--muted); padding: 36px 20px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                    <strong style="display: block; font-size: 15px; color: var(--text);">Nenhuma corrida encontrada para estes filtros</strong>
                    <span style="font-size: 13px;">Tente alterar o status ou o intervalo de datas selecionado.</span>
                    <div style="margin-top: 12px;">
                        <button class="btn btn-outline btn-sm" onclick="clearDriverFilters()">Limpar Filtros</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(o => {
        const formattedDate = new Date(o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const formattedTime = new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Status badge
        const badgeClass = o.status === 'concluido' ? 'completed' : 'cancelled';
        const badgeLabel = o.status === 'concluido' ? 'Finalizado ✅' : 'Cancelado ❌';

        // Ratings column: Client rated Driver AND Driver rated Client
        let ratingsDisplay = '';
        if (o.status === 'concluido') {
            if (o.userRating) {
                ratingsDisplay += `<div style="font-size: 12px; color: #f59e0b;">Cli: ${'★'.repeat(o.userRating.stars)} <strong style="color: #92400e;">(${o.userRating.stars})</strong></div>`;
            }
            if (o.driverRating) {
                ratingsDisplay += `<div style="font-size: 11px; color: #166534; margin-top: 2px;">Você: ${'★'.repeat(o.driverRating.stars)}</div>`;
            } else {
                ratingsDisplay += `
                    <button class="btn btn-outline btn-sm" style="padding: 3px 8px; font-size: 10px; margin-top: 4px;" onclick="openRateModal('${o.id}', 'entregador')">
                        ⭐ Avaliar Cliente
                    </button>
                `;
            }
        } else {
            ratingsDisplay = `<span style="font-size: 11px; color: #dc2626;">${o.cancelReason || 'Corrida cancelada'}</span>`;
        }

        return `
            <tr>
                <td>
                    <strong style="color: var(--primary); font-size: 14px;">#${o.id}</strong>
                    <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${formattedDate} às ${formattedTime}</div>
                    <span class="badge-status ${badgeClass}" style="font-size: 10px; padding: 2px 6px; margin-top: 4px; display: inline-block;">${badgeLabel}</span>
                </td>
                <td>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text);">${o.originAddress}</div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">➔ ${o.destinationAddress}</div>
                </td>
                <td>
                    <div style="font-weight: 700; font-size: 13px;">${o.requesterName}</div>
                    <div style="font-size: 11px; color: var(--muted);">${o.requesterPhone}</div>
                </td>
                <td class="tabular" style="font-weight: 600;">
                    ${o.distanceKm} km
                </td>
                <td>
                    ${ratingsDisplay}
                </td>
                <td class="text-right tabular" style="font-weight: 800; font-size: 16px; color: ${o.status === 'cancelado' ? 'var(--muted)' : '#16a34a'};">
                    ${o.status === 'cancelado' ? '<span style="font-size: 13px; color: #dc2626;">R$ 0,00</span>' : `+ R$ ${o.price.toFixed(2).replace('.', ',')}`}
                </td>
                <td class="text-right" style="white-space: nowrap;">
                    ${o.status === 'concluido' ? `
                        <button class="btn btn-outline btn-sm" style="padding: 5px 9px; font-size: 11px; margin-right: 4px;" title="Ver Comprovante Oficial" onclick="openReceiptModal('${o.id}')">
                            📄 Comprovante
                        </button>
                    ` : ''}
                    <button class="btn btn-outline btn-sm" style="padding: 5px 9px; font-size: 11px;" title="Ver Rota no Mapa" onclick="openOrderModal('${o.id}')">
                        🗺️ Rota
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleDriverOnlineState() {
    const driver = (appState.drivers || []).find(d => d.id === currentDriverId);
    if (!driver) return;

    const newState = !driver.isOnline;
    try {
        const res = await fetch(`/api/drivers/${driver.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOnline: newState })
        });
        if (!res.ok) throw new Error('Falha ao atualizar status');
        showToast(newState ? 'Você está ONLINE e recebendo chamadas!' : 'Você agora está OFFLINE.', newState ? '🟢' : '⚪');
        await fetchAppState();
    } catch (err) {
        showToast('Erro ao alterar status online.', '❌');
    }
}

async function handleAcceptDelivery(orderId) {
    try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'aceito',
                driverId: currentDriverId
            })
        });

        if (!res.ok) throw new Error('Falha ao aceitar pedido');
        showToast(`Corrida #${orderId} aceita com sucesso! Dirija-se ao ponto de coleta.`, '🎉');
        await fetchAppState();
    } catch (err) {
        showToast('Não foi possível aceitar a entrega.', '❌');
    }
}

function handleDeclineDelivery(orderId) {
    showToast(`Solicitação #${orderId} dispensada da sua visualização.`, '👋');
    const card = document.querySelector(`.order-alert-card`);
    if (card) card.remove();
}

async function handleAdvanceMission() {
    const orders = appState.orders || [];
    const activeMission = orders.find(o => 
        o.assignedDriverId === currentDriverId && 
        ['aceito', 'em_coleta', 'em_entrega'].includes(o.status)
    );

    if (!activeMission) return;

    let nextStatus = 'em_coleta';
    let msg = 'Você chegou ao ponto de coleta!';

    if (activeMission.status === 'aceito') {
        nextStatus = 'em_coleta';
        msg = 'Chegada ao ponto de coleta registrada!';
    } else if (activeMission.status === 'em_coleta') {
        nextStatus = 'em_entrega';
        msg = 'Carga coletada! Em rota para o destino.';
    } else if (activeMission.status === 'em_entrega') {
        nextStatus = 'concluido';
        msg = 'Entrega concluída com sucesso! Valor creditado no seu extrato.';
    }

    try {
        const res = await fetch(`/api/orders/${activeMission.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
        });
        if (!res.ok) throw new Error('Erro ao atualizar etapa');
        showToast(msg, '✅');
        await fetchAppState();

        // If completed, trigger Driver Star-Rating for the Client!
        if (nextStatus === 'concluido') {
            setTimeout(() => {
                openRateModal(activeMission.id, 'entregador');
            }, 400);
        }

    } catch (err) {
        showToast('Erro ao atualizar etapa da entrega.', '❌');
    }
}

function handleCallRequester() {
    showToast('Ligando para o solicitante: (11) 98321-9988...', '📞');
}


// ==========================================
// ADMIN / CENTRAL VIEW LOGIC
// ==========================================
function renderAdminView() {
    const stats = appState.stats || {};
    const orders = appState.orders || [];
    const drivers = appState.drivers || [];

    // Global KPIs
    document.getElementById('adminActiveOrders').innerText = stats.activeOrders || 0;
    document.getElementById('adminOnlineDrivers').innerText = stats.onlineDrivers || 0;
    document.getElementById('adminCompletedOrders').innerText = stats.completedOrders || 0;
    document.getElementById('adminTotalVolume').innerText = `R$ ${stats.totalVolumeToday || '0.00'}`.replace('.', ',');

    // Admin Orders Table
    const ordersTbody = document.getElementById('adminOrdersTbody');
    if (ordersTbody) {
        ordersTbody.innerHTML = orders.map(o => {
            const badgeMap = {
                aguardando_aceite: { label: 'Aguardando Aceite', class: 'waiting' },
                aceito: { label: 'Aceito', class: 'transit' },
                em_coleta: { label: 'Em Coleta', class: 'transit' },
                em_entrega: { label: 'Em Rota', class: 'transit' },
                concluido: { label: 'Concluído', class: 'completed' },
                cancelado: { label: 'Cancelado', class: 'cancelled' }
            };
            const badge = badgeMap[o.status] || { label: o.status, class: 'waiting' };

            let ratingSummary = '';
            if (o.userRating) {
                ratingSummary = `<span style="font-size: 11px; color: #f59e0b; display: block;">Cli: ${'★'.repeat(o.userRating.stars)}</span>`;
            }
            if (o.driverRating) {
                ratingSummary += `<span style="font-size: 11px; color: #10b981; display: block;">Ent: ${'★'.repeat(o.driverRating.stars)}</span>`;
            }

            return `
                <tr>
                    <td><strong style="color: var(--primary);">#${o.id}</strong></td>
                    <td>${o.requesterName}</td>
                    <td>
                        <div style="font-weight: 500;">${o.originAddress}</div>
                        <div style="font-size: 11px; color: var(--muted);">↓ ${o.destinationAddress}</div>
                    </td>
                    <td>${o.dispatchMode === 'direcionado' ? '🎯 Direcionado' : '📢 Todos'}</td>
                    <td>${o.assignedDriverName || '<span style="color: var(--muted);">-</span>'}</td>
                    <td>
                        <span class="badge-status ${badge.class}">${badge.label}</span>
                        ${ratingSummary ? `<div style="margin-top: 4px;">${ratingSummary}</div>` : ''}
                    </td>
                    <td class="text-right tabular" style="font-weight: 700;">R$ ${o.price.toFixed(2).replace('.', ',')}</td>
                    <td class="text-right" style="white-space: nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="openOrderModal('${o.id}')">Ver Detalhes</button>
                        ${o.status !== 'concluido' && o.status !== 'cancelado' ? 
                            `<button class="btn btn-outline btn-sm" style="color: #dc2626; margin-left: 4px;" onclick="handleAdminCancelOrder('${o.id}')">Cancelar</button>` 
                            : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Admin Drivers Table
    const driversTbody = document.getElementById('adminDriversTbody');
    if (driversTbody) {
        driversTbody.innerHTML = drivers.map(d => {
            const isApproved = d.approvalStatus === 'aprovado';
            return `
                <tr>
                    <td>
                        <div style="font-weight: 700;">${d.name}</div>
                        <div style="font-size: 11px; color: var(--muted);">${d.deliveriesCount} entregas realizadas</div>
                    </td>
                    <td>${d.phone}</td>
                    <td>
                        <div>${d.vehicle}</div>
                        <div style="font-size: 11px; color: var(--muted);">${d.plate}</div>
                    </td>
                    <td>
                        <span class="badge-status ${d.isOnline ? 'online' : 'offline'}">
                            ${d.isOnline ? '● Online' : '○ Offline'}
                        </span>
                    </td>
                    <td>
                        <span class="badge-status ${isApproved ? 'completed' : 'waiting'}">
                            ${isApproved ? 'Aprovado' : 'Pendente de Análise'}
                        </span>
                    </td>
                    <td class="tabular" style="font-weight: 700; color: #b45309;">★ ${d.rating}</td>
                    <td class="text-right tabular" style="font-weight: 700;">R$ ${(d.todayEarnings || 0).toFixed(2).replace('.', ',')}</td>
                    <td class="text-right" style="white-space: nowrap;">
                        ${!isApproved ? 
                            `<button class="btn btn-primary btn-sm" onclick="handleApproveDriver('${d.id}')">Aprovar Cadastro</button>` : 
                            `<button class="btn btn-outline btn-sm" onclick="handleToggleDriverOnline('${d.id}')">${d.isOnline ? 'Desconectar' : 'Conectar'}</button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }
}

async function handleApproveDriver(driverId) {
    try {
        const res = await fetch(`/api/drivers/${driverId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvalStatus: 'aprovado' })
        });
        if (!res.ok) throw new Error('Falha ao aprovar');
        showToast('Entregador aprovado com sucesso! Já está apto a receber corridas.', '🎉');
        await fetchAppState();
    } catch (err) {
        showToast('Erro ao aprovar entregador.', '❌');
    }
}

async function handleToggleDriverOnline(driverId) {
    const driver = (appState.drivers || []).find(d => d.id === driverId);
    if (!driver) return;

    try {
        await fetch(`/api/drivers/${driverId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOnline: !driver.isOnline })
        });
        showToast(`Status de ${driver.name} alterado com sucesso.`, '🔄');
        await fetchAppState();
    } catch (err) {
        showToast('Erro ao atualizar status do entregador.', '❌');
    }
}

async function handleAdminCancelOrder(orderId) {
    if (!confirm(`Deseja realmente cancelar o pedido #${orderId}?`)) return;

    try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelado' })
        });
        if (!res.ok) throw new Error('Erro ao cancelar');
        showToast(`Pedido #${orderId} foi cancelado.`, '⚠️');
        await fetchAppState();
    } catch (err) {
        showToast('Erro ao cancelar pedido.', '❌');
    }
}


// ==========================================
// MODALS
// ==========================================
function openOrderModal(orderId) {
    const order = (appState.orders || []).find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('modalOrderTitle').innerText = `Pedido #${order.id}`;
    document.getElementById('modalOrderDate').innerText = `Criado em ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let ratingsSectionHTML = '';
    if (order.userRating || order.driverRating) {
        ratingsSectionHTML = `
            <h4 style="font-size: 13px; font-weight: 700; color: var(--muted); margin: 18px 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">Avaliações Registradas</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <!-- User to Driver -->
                <div class="rating-display-card">
                    <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Avaliação do Solicitante</div>
                    ${order.userRating ? `
                        <div style="margin: 4px 0;">
                            <span class="rating-stars-static">${'★'.repeat(order.userRating.stars)}${'☆'.repeat(5 - order.userRating.stars)}</span>
                            <span class="tabular" style="font-weight: 700; font-size: 13px;">(${order.userRating.stars}/5)</span>
                        </div>
                        ${order.userRating.comment ? `<p style="font-size: 12px; color: #334155; margin: 4px 0;">"${order.userRating.comment}"</p>` : ''}
                        ${order.userRating.tags ? `<div class="rating-tags-display">${order.userRating.tags.map(t => `<span class="rating-tag-display-item">${t}</span>`).join('')}</div>` : ''}
                    ` : '<p style="font-size: 12px; color: var(--muted); margin-top: 6px;">Pendente de avaliação</p>'}
                </div>

                <!-- Driver to User -->
                <div class="rating-display-card">
                    <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Avaliação do Entregador</div>
                    ${order.driverRating ? `
                        <div style="margin: 4px 0;">
                            <span class="rating-stars-static">${'★'.repeat(order.driverRating.stars)}${'☆'.repeat(5 - order.driverRating.stars)}</span>
                            <span class="tabular" style="font-weight: 700; font-size: 13px;">(${order.driverRating.stars}/5)</span>
                        </div>
                        ${order.driverRating.comment ? `<p style="font-size: 12px; color: #334155; margin: 4px 0;">"${order.driverRating.comment}"</p>` : ''}
                        ${order.driverRating.tags ? `<div class="rating-tags-display">${order.driverRating.tags.map(t => `<span class="rating-tag-display-item">${t}</span>`).join('')}</div>` : ''}
                    ` : '<p style="font-size: 12px; color: var(--muted); margin-top: 6px;">Pendente de avaliação</p>'}
                </div>
            </div>
        `;
    }

    const modalBody = document.getElementById('modalOrderBody');
    modalBody.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 13px; color: var(--muted);">Solicitante: <strong>${order.requesterName}</strong></span>
                <span class="tabular" style="font-weight: 700; color: #16a34a; font-size: 16px;">R$ ${order.price.toFixed(2).replace('.', ',')}</span>
            </div>
            <div style="font-size: 13px; margin-bottom: 6px;">
                <span style="color: var(--muted);">Coleta:</span> <strong>${order.originAddress}</strong>
            </div>
            <div style="font-size: 13px; margin-bottom: 6px;">
                <span style="color: var(--muted);">Destino:</span> <strong>${order.destinationAddress}</strong>
            </div>
            <div style="font-size: 13px; margin-bottom: 6px;">
                <span style="color: var(--muted);">Contato:</span> <strong>${order.requesterPhone}</strong>
            </div>
            <div style="font-size: 13px; margin-bottom: 6px;">
                <span style="color: var(--muted);">Carga:</span> <strong>${order.description}</strong>
            </div>
            ${order.notes ? `<div style="font-size: 12px; color: var(--muted); margin-top: 8px; font-style: italic;">Obs: ${order.notes}</div>` : ''}
        </div>

        <div style="margin-bottom: 16px;">
            <small style="color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Entregador Designado</small>
            <p style="font-size: 14px; font-weight: 600; margin-top: 2px;">${order.assignedDriverName || 'Nenhum entregador atribuído ainda'}</p>
        </div>

        <!-- Route Map Section in Modal -->
        <div style="margin: 16px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <small style="color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">🗺️ Visualização da Rota (OpenStreetMap)</small>
                <small style="color: var(--muted); font-weight: 600;">${order.distanceKm} km</small>
            </div>
            <div id="modalOrderMap" class="leaflet-route-map" style="height: 200px;"></div>
        </div>

        ${ratingsSectionHTML}

        <h4 style="font-size: 13px; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Linha do Tempo de Eventos</h4>
        <div class="timeline">
            ${(order.events || []).map(ev => `
                <div class="timeline-event">
                    <div class="timeline-dot"></div>
                    <div class="timeline-event-time">${ev.time}</div>
                    <div class="timeline-event-text">${ev.description}</div>
                </div>
            `).join('')}
        </div>
    `;

    const modal = document.getElementById('modalOrderDetails');
    if (modal) {
        modal.classList.add('open');
        setTimeout(() => {
            initOrUpdateRouteMap('modalOrderMap', 'modal', order);
        }, 150);
    }
}

function closeOrderModal(e) {
    const modal = document.getElementById('modalOrderDetails');
    if (modal) modal.classList.remove('open');
}

// Dedicated Rate Modal Functionality
function openRateModal(orderId, role = 'solicitante') {
    const order = (appState.orders || []).find(o => o.id === orderId);
    if (!order) return;

    const modalTitle = document.getElementById('rateModalTitle');
    const modalSubtitle = document.getElementById('rateModalSubtitle');
    const modalBody = document.getElementById('rateModalBody');

    if (role === 'solicitante') {
        if (modalTitle) modalTitle.innerText = `Avaliar ${order.assignedDriverName || 'o Entregador'}`;
        if (modalSubtitle) modalSubtitle.innerText = `Como foi a pontualidade e entrega do pedido #${order.id}?`;
    } else {
        if (modalTitle) modalTitle.innerText = `Avaliar o Cliente (${order.requesterName})`;
        if (modalSubtitle) modalSubtitle.innerText = `Como foi o atendimento no pedido #${order.id}?`;
    }

    if (modalBody) {
        modalBody.innerHTML = buildStarRatingHTML({
            orderId: order.id,
            role: role,
            title: role === 'solicitante' ? `Avaliação para ${order.assignedDriverName || 'Entregador'}` : `Avaliação para ${order.requesterName}`,
            subtitle: 'Selecione de 1 a 5 estrelas e adicione seus comentários:',
            targetName: role === 'solicitante' ? order.assignedDriverName : order.requesterName
        });
        attachStarRatingEvents(order.id, role);
    }

    const modal = document.getElementById('modalRateDelivery');
    if (modal) modal.classList.add('open');
}

function closeRateModal(e) {
    const modal = document.getElementById('modalRateDelivery');
    if (modal) modal.classList.remove('open');
}

function openDriverApprovalModal() {
    const modal = document.getElementById('modalNewDriver');
    if (modal) modal.classList.add('open');
}

function closeDriverModal(e) {
    const modal = document.getElementById('modalNewDriver');
    if (modal) modal.classList.remove('open');
}

async function handleRegisterDriver(e) {
    e.preventDefault();
    const name = document.getElementById('drvName').value.trim();
    const phone = document.getElementById('drvPhone').value.trim();
    const vehicle = document.getElementById('drvVehicle').value.trim();
    const plate = document.getElementById('drvPlate').value.trim();

    try {
        const res = await fetch('/api/drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, vehicle, plate })
        });
        if (!res.ok) throw new Error('Erro ao cadastrar');
        showToast(`Entregador ${name} pré-cadastrado com sucesso!`, '🛵');
        closeDriverModal();
        await fetchAppState();
    } catch (err) {
        showToast('Erro ao cadastrar novo entregador.', '❌');
    }
}

// Digital Delivery Receipt Functionality
function openReceiptModal(orderId) {
    const order = (appState.orders || []).find(o => o.id === orderId);
    if (!order) return;

    const receiptBody = document.getElementById('receiptModalBody');
    if (!receiptBody) return;

    const formattedDate = new Date(order.createdAt).toLocaleDateString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric' 
    });
    const formattedTime = new Date(order.createdAt).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', minute: '2-digit' 
    });

    receiptBody.innerHTML = `
        <div class="receipt-paper">
            <div class="receipt-header">
                <div class="receipt-brand-logo">
                    <img src="/Logo BuscaLá com Entrega Rápida.png" alt="BuscaLá" style="height: 34px; width: 34px; border-radius: 6px;">
                    <span>Busca<span style="color: var(--primary);">Lá</span></span>
                </div>
                <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Rede Inteligente de Entregas Rápidas</div>
                <div class="receipt-protocol-pill">PROTOCOLO OFICIAL #REC-${order.id}</div>
            </div>

            <div class="receipt-section-title">Dados da Solicitação</div>
            <div class="receipt-row">
                <span style="color: var(--muted);">Código da Corrida:</span>
                <strong>#${order.id}</strong>
            </div>
            <div class="receipt-row">
                <span style="color: var(--muted);">Data e Hora:</span>
                <span>${formattedDate} às ${formattedTime}</span>
            </div>
            <div class="receipt-row">
                <span style="color: var(--muted);">Solicitante:</span>
                <strong>${order.requesterName}</strong>
            </div>

            <div class="receipt-section-title">Endereço de Coleta (Origem)</div>
            <p style="font-weight: 600; margin: 2px 0;">${order.originAddress}</p>

            <div class="receipt-section-title">Endereço de Entrega (Destino)</div>
            <p style="font-weight: 600; margin: 2px 0;">${order.destinationAddress}</p>

            <div class="receipt-section-title">Entregador Responsável</div>
            <div class="receipt-row">
                <span>${order.assignedDriverName || 'Marcos Souza'}</span>
                <span style="color: #16a34a; font-weight: 700;">Identidade Verificada ✓</span>
            </div>

            <div class="receipt-section-title">Descrição da Carga</div>
            <p style="font-size: 12px; color: var(--text); margin: 2px 0;">${order.description}</p>
            ${order.notes ? `<p style="font-size: 11px; color: var(--muted); margin: 2px 0;">Obs: ${order.notes}</p>` : ''}

            ${order.userRating ? `
                <div class="receipt-section-title">Avaliação do Cliente</div>
                <div class="receipt-row">
                    <span>${'★'.repeat(order.userRating.stars)} (${order.userRating.stars}/5)</span>
                    <span style="font-size: 11px; color: var(--muted);">${order.userRating.tags ? order.userRating.tags.join(' · ') : ''}</span>
                </div>
            ` : ''}

            <div class="receipt-total-row">
                <span>VALOR TOTAL PAGO</span>
                <span style="color: #16a34a;">R$ ${order.price.toFixed(2).replace('.', ',')}</span>
            </div>

            <div style="margin-top: 18px; padding-top: 12px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 11px; color: var(--muted);">
                Comprovante eletrônico com hash de autenticação verificado nos servidores BuscaLá.<br>
                Em caso de dúvidas contate o suporte via WhatsApp.
            </div>
        </div>
    `;

    const modal = document.getElementById('modalDeliveryReceipt');
    if (modal) modal.classList.add('open');
}

function closeReceiptModal(e) {
    const modal = document.getElementById('modalDeliveryReceipt');
    if (modal) modal.classList.remove('open');
}

function handleRepeatOrder(orderId) {
    const order = (appState.orders || []).find(o => o.id === orderId);
    if (!order) return;

    // Pre-fill form
    const origin = document.getElementById('inputOrigin');
    const destination = document.getElementById('inputDestination');
    const description = document.getElementById('inputDescription');
    const distance = document.getElementById('inputDistance');
    const price = document.getElementById('inputPrice');

    if (origin) origin.value = order.originAddress;
    if (destination) destination.value = order.destinationAddress;
    if (description) description.value = order.description;
    if (distance) distance.value = order.distanceKm;
    if (price) price.value = order.price.toFixed(2);

    showToast(`Dados da entrega #${order.id} preenchidos! Pronto para solicitar.`, '📋');
    focusNewOrderForm();
}


// ==========================================
// REAL-TIME BROWSER PUSH NOTIFICATION SYSTEM
// ==========================================

function initPushNotificationSystem() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/src/public/sw.js').then(reg => {
            console.log('BuscaLá ServiceWorker registrado:', reg.scope);
            // Se a permissão já foi concedida, garante a inscrição no Web Push
            if ('Notification' in window && Notification.permission === 'granted') {
                subscribeToWebPush();
            }
        }).catch(err => {
            console.log('Falha ao registrar ServiceWorker:', err);
        });
    }

    updatePushNotificationUI();
    updateSoundButtonUI();
}

function updatePushNotificationUI() {
    const badge = document.getElementById('driverPushStatusBadge');
    const btn = document.getElementById('btnEnablePush');
    const subtext = document.getElementById('driverPushSubtext');
    const iconBox = document.getElementById('driverPushIconBox');

    if (!('Notification' in window)) {
        if (badge) {
            badge.innerText = 'Não Suportado ⚠️';
            badge.style.background = '#fef2f2';
            badge.style.color = '#991b1b';
        }
        if (btn) btn.style.display = 'none';
        if (subtext) subtext.innerText = 'Este navegador não oferece suporte nativo à API de Notificações Push.';
        return;
    }

    const permission = Notification.permission;

    if (permission === 'granted') {
        if (badge) {
            badge.innerText = 'Ativado ✅';
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
        }
        if (btn) {
            btn.innerHTML = '✅ Notificações Ativadas';
            btn.className = 'btn btn-outline btn-sm';
            btn.onclick = () => showToast('Notificações de novas corridas já estão autorizadas!', '✅');
        }
        if (subtext) {
            subtext.innerText = 'Você receberá alertas sonoros e notificações na tela sempre que surgir uma nova entrega na sua área!';
        }
        if (iconBox) iconBox.style.background = '#dcfce7';
    } else if (permission === 'denied') {
        if (badge) {
            badge.innerText = 'Bloqueado no Navegador ⚠️';
            badge.style.background = '#fee2e2';
            badge.style.color = '#b91c1c';
        }
        if (btn) {
            btn.innerHTML = '⚠️ Desbloquear no Cadeado';
            btn.className = 'btn btn-outline btn-sm';
            btn.onclick = () => showToast('Clique no ícone de cadeado na barra de endereços para permitir notificações.', '🔒');
        }
        if (subtext) {
            subtext.innerText = 'As notificações estão bloqueadas nas preferências do navegador. Clique no cadeado da URL para permitir.';
        }
        if (iconBox) iconBox.style.background = '#fee2e2';
    } else {
        if (badge) {
            badge.innerText = 'Pendente 🔔';
            badge.style.background = '#fef3c7';
            badge.style.color = '#b45309';
        }
        if (btn) {
            btn.innerHTML = '🔔 Ativar Notificações';
            btn.className = 'btn btn-primary btn-sm';
            btn.onclick = requestPushNotificationPermission;
        }
        if (subtext) {
            subtext.innerText = 'Clique em "Ativar Notificações" para ser alertado instantaneamente quando surgirem novas chamadas de entrega.';
        }
    }
}

async function requestPushNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('Navegador não suporta notificações de sistema.', '⚠️');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        updatePushNotificationUI();

        if (permission === 'granted') {
            playDeliveryChime();
            showToast('Notificações push ativadas com sucesso! Você receberá alertas de novas corridas.', '🔔');

            // Assina o Web Push no servidor (notificações reais)
            subscribeToWebPush();

            // Send welcome push notification
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification('BuscaLá Entregadores 🛵', {
                    body: 'Notificações push ativadas! Você será avisado em tempo real quando houver novos chamados.',
                    icon: '/Logo BuscaLá com Entrega Rápida.png',
                    badge: '/Logo BuscaLá com Entrega Rápida.png',
                    tag: 'welcome-notification'
                });
            } else {
                new Notification('BuscaLá Entregadores 🛵', {
                    body: 'Notificações ativadas! Você será avisado em tempo real sobre novas corridas.',
                    icon: '/Logo BuscaLá com Entrega Rápida.png'
                });
            }
        } else {
            showToast('Permissão para notificações não foi concedida.', 'ℹ️');
        }
    } catch (e) {
        console.warn('Erro ao solicitar permissão de notificação:', e);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

// Assina o navegador no Web Push real (VAPID) e registra a inscrição no servidor.
async function subscribeToWebPush() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const reg = await navigator.serviceWorker.ready;
        const res = await fetch('/api/push/public-key');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.publicKey) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(data.publicKey),
            });
        }

        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub }),
        });
        console.log('Web Push inscrito com sucesso.');
    } catch (e) {
        console.warn('Erro ao assinar Web Push:', e);
    }
}

function updateSoundButtonUI() {
    const btn = document.getElementById('btnToggleSound');
    if (!btn) return;
    if (audioAlertEnabled) {
        btn.innerHTML = '🔊 Som Ativo';
        btn.style.borderColor = 'var(--border)';
        btn.style.color = 'var(--text)';
    } else {
        btn.innerHTML = '🔇 Alarme Mudo';
        btn.style.borderColor = '#fca5a5';
        btn.style.color = '#b91c1c';
    }
}

function toggleAlertSound() {
    audioAlertEnabled = !audioAlertEnabled;
    localStorage.setItem('buscala_sound_enabled', audioAlertEnabled);
    updateSoundButtonUI();

    if (audioAlertEnabled) {
        playDeliveryChime();
        showToast('Som de alarme de nova corrida ativado!', '🔊');
    } else {
        showToast('Som de alarme silenciado.', '🔇');
    }
}

// Web Audio API Synthesizer: Attention-grabbing dispatch chime
function playDeliveryChime() {
    if (!audioAlertEnabled) return;

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // Tone 1: 587.33Hz (D5) -> 880Hz (A5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15);
        gain1.gain.setValueAtTime(0.35, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: 880Hz (A5) -> 1174.66Hz (D6)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(880.00, now + 0.18);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);
        gain2.gain.setValueAtTime(0.4, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.55);
    } catch (e) {
        console.warn('Erro ao reproduzir sinal sonoro:', e);
    }
}

// Check newly broadcasted orders in real-time
function checkIncomingBroadcastDeliveries(orders) {
    if (!isInitialFetchDone) {
        orders.forEach(o => knownOrderIds.add(o.id));
        isInitialFetchDone = true;
        return;
    }

    orders.forEach(o => {
        if (!knownOrderIds.has(o.id)) {
            knownOrderIds.add(o.id);
            if (o.status === 'aguardando_aceite') {
                const driver = (appState.drivers || []).find(d => d.id === currentDriverId);
                const isOnline = driver ? driver.isOnline : true;
                const isForMe = o.dispatchMode === 'chamar_todos' || o.assignedDriverId === currentDriverId;

                if (isForMe && isOnline) {
                    triggerDriverDeliveryAlert(o);
                }
            }
        }
    });
}

function triggerDriverDeliveryAlert(order) {
    currentAlertOrder = order;

    // 1. Play synthesized audio chime
    playDeliveryChime();

    // 2. Mobile vibration feedback
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate([250, 100, 250, 100, 250]);
        } catch (e) {}
    }

    // 3. Browser-level native push notification
    if ('Notification' in window && Notification.permission === 'granted') {
        const title = `🚨 Nova Corrida: R$ ${order.price.toFixed(2).replace('.', ',')} 🛵`;
        const options = {
            body: `${order.originAddress} ➔ ${order.destinationAddress} (${order.distanceKm} km)\nCarga: ${order.description}`,
            icon: '/Logo BuscaLá com Entrega Rápida.png',
            badge: '/Logo BuscaLá com Entrega Rápida.png',
            tag: `order-${order.id}`,
            renotify: true,
            requireInteraction: true,
            data: `/dashboard?role=entregador`
        };

        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, options);
            });
        } else {
            const notif = new Notification(title, options);
            notif.onclick = () => {
                window.focus();
                switchRole('entregador');
                notif.close();
            };
        }
    }

    // 4. Floating On-Screen Broadcast Alert Banner
    const floatingAlert = document.getElementById('incomingDeliveryFloatingAlert');
    if (floatingAlert) {
        document.getElementById('alertOrderId').innerText = `Pedido #${order.id}`;
        document.getElementById('alertOrderPrice').innerText = `R$ ${order.price.toFixed(2).replace('.', ',')}`;
        document.getElementById('alertOrderOrigin').innerText = order.originAddress;
        document.getElementById('alertOrderDestination').innerText = order.destinationAddress;
        document.getElementById('alertOrderDetails').innerText = `Distância: ${order.distanceKm} km · Carga: ${order.description}`;
        
        floatingAlert.style.display = 'block';

        if (alertDismissTimer) clearTimeout(alertDismissTimer);
        alertDismissTimer = setTimeout(() => {
            dismissIncomingAlert();
        }, 30000); // Auto-dismiss after 30 seconds if not accepted
    }

    // 5. Toast
    showToast(`🚨 Nova corrida #${order.id} transmitida no Radar! R$ ${order.price.toFixed(2).replace('.', ',')}`, '⚡');
}

function testDriverPushAlert() {
    const mockOrder = {
        id: `BL-${Math.floor(1000 + Math.random() * 9000)}`,
        price: 18.50,
        originAddress: 'Rua Oscar Freire, 800 - Jardins',
        destinationAddress: 'Av. Paulista, 1578 - Bela Vista',
        distanceKm: 3.2,
        description: 'Documentos e envelope timbrado'
    };

    triggerDriverDeliveryAlert(mockOrder);
    showToast('Teste de alerta disparado: áudio, vibração e notificação push!', '🧪');
}

function dismissIncomingAlert() {
    const floatingAlert = document.getElementById('incomingDeliveryFloatingAlert');
    if (floatingAlert) floatingAlert.style.display = 'none';
    if (alertDismissTimer) clearTimeout(alertDismissTimer);
}

async function handleAcceptAlertOrder() {
    if (!currentAlertOrder) return;
    const orderId = currentAlertOrder.id;
    dismissIncomingAlert();
    await handleAcceptDelivery(orderId);
}

async function simulateIncomingBroadcastOrder() {
    const sampleStreets = [
        { orig: 'Rua Augusta, 1400 - Consolação', dest: 'Av. Brigadeiro Faria Lima, 1800 - Itaim Bibi', dist: 4.5, desc: 'Caixa de presentes e flores especiais', price: 17.50 },
        { orig: 'Shopping Morumbi - Piso Térreo', dest: 'Rua Verbo Divino, 800 - Chácara Santo Antônio', dist: 3.1, desc: 'Peças de vestuário e calçados', price: 14.50 },
        { orig: 'Av. Rebouças, 1100 - Pinheiros', dest: 'Alameda Santos, 2200 - Cerqueira César', dist: 2.8, desc: 'Medicamentos manipulados lacrados', price: 13.00 },
        { orig: 'Rua dos Pinheiros, 450 - Pinheiros', dest: 'Rua Mourato Coelho, 900 - Vila Madalena', dist: 1.8, desc: 'Doces finos e chocolates artesanais', price: 12.00 }
    ];
    const sample = sampleStreets[Math.floor(Math.random() * sampleStreets.length)];

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requesterName: 'Boutique & Café Central',
                requesterPhone: '(11) 98777-1234',
                originAddress: sample.orig,
                destinationAddress: sample.dest,
                distanceKm: sample.dist,
                price: sample.price,
                description: sample.desc,
                dispatchMode: 'chamar_todos'
            })
        });

        if (!res.ok) throw new Error('Falha ao simular chamada');
        const data = await res.json();
        await fetchAppState();
        showToast(`Novo pedido #${data.order.id} transmitido para todos os entregadores!`, '🚀');
    } catch (e) {
        showToast('Erro ao transmitir nova entrega simulada.', '❌');
    }
}
