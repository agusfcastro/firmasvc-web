/*
 * FIRMA · Service worker del portal.
 *
 * Solo muestra notificaciones push y abre el portal al tocarlas. No guarda
 * nada en caché: el portal siempre se carga de la red, como hasta ahora.
 * El servidor manda { titulo, cuerpo, url, etiqueta } cifrado (api/_lib/push.ts).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : '' };
  }
  const url = typeof datos.url === 'string' && datos.url.startsWith('/') ? datos.url : '/portal';
  event.waitUntil(
    self.registration.showNotification(datos.titulo || 'FIRMA', {
      body: datos.cuerpo || 'Tenés una novedad en el portal.',
      icon: '/app/icono-192.png',
      badge: '/app/icono-192.png',
      tag: datos.etiqueta || undefined,
      data: { url },
      lang: 'es-AR',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/portal', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of abiertas) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          await c.focus();
          if ('navigate' in c) await c.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
