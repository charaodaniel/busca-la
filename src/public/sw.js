// Busca Lá Service Worker with Push & Notification Support
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Push Notification Event Listener
self.addEventListener('push', (event) => {
  let data = {
    title: 'Nova Entrega Disponível! 🛵',
    body: 'Uma nova corrida foi transmitida para você.',
    url: '/dashboard?role=entregador',
    id: 'push-' + Date.now()
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/Logo BuscaLá com Entrega Rápida.png',
    badge: '/Logo BuscaLá com Entrega Rápida.png',
    vibrate: [250, 100, 250, 100, 250],
    data: data.url || '/dashboard?role=entregador',
    tag: data.id || 'delivery-alert',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'accept', title: '⚡ Abrir e Aceitar' },
      { action: 'close', title: 'Dispensar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data || '/dashboard?role=entregador';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
