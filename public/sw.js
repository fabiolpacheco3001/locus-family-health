/**
 * Locus Vita — Service Worker
 * Handles background Push Notifications (Web Push / VAPID).
 * Supports iOS 16.4+ PWA (home screen) + Android Chrome/Firefox/Edge.
 *
 * SCOPE: / (root — covers the entire app)
 * REGISTERED BY: src/main.tsx (manual, no vite-plugin-pwa)
 */

const APP_NAME = 'Locus Vita';
const DEFAULT_ICON = 'https://locus-family-vita.lovable.app/icon-192.png';
const DEFAULT_BADGE = 'https://locus-family-vita.lovable.app/badge-96.png';

// ── Push event: fired when server sends a push message ──────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: APP_NAME, body: event.data.text(), url: '/' };
  }

  const {
    title = APP_NAME,
    body = '',
    url = '/',
    icon = DEFAULT_ICON,
    badge = DEFAULT_BADGE,
    tag,
    type = 'generic',
    data = {},
  } = payload;

  // Build notification options following W3C spec
  // iOS 16.4+ supports: title, body, icon, badge, tag, data
  // iOS does NOT support: actions, image, vibrate (silently ignored)
  const options = {
    body,
    icon,
    badge,
    tag: tag || `${type}-${Date.now()}`,
    data: { url, type, ...data },
    // Renotify if same tag (for medication reminders: each dose is new)
    renotify: type === 'medication_dose',
    // Silent only for low-priority types
    silent: type === 'changelog',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click: open/focus the app and navigate to action URL ───────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If there's already a window open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Push subscription change: re-subscribe automatically if invalidated ──────
// Fired by Firefox/Chrome when the push service rotates the endpoint.
// iOS 16.4 raramente dispara este evento — o app detecta na abertura via usePushSubscription.ts.
self.addEventListener('pushsubscriptionchange', (event) => {
  const oldSub = event.oldSubscription;

  const resubscribeAndNotify = async () => {
    let newSub = event.newSubscription ?? null;

    // Se não veio newSubscription pronto, tentar re-assinar com a mesma chave VAPID
    if (!newSub && oldSub?.options?.applicationServerKey) {
      try {
        newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: oldSub.options.applicationServerKey,
        });
      } catch {
        // Re-subscribe falhou — app vai corrigir na próxima abertura
      }
    }

    // Notificar janelas abertas do app para sincronizar a nova subscription ao Supabase
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const message = newSub
      ? { type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSub.toJSON() }
      : { type: 'PUSH_SUBSCRIPTION_LOST' };
    clientList.forEach((client) => client.postMessage(message));
  };

  event.waitUntil(resubscribeAndNotify());
});

// ── Install & Activate: minimal — no precaching (app is SPA with Vite) ──────
self.addEventListener('install', () => {
  self.skipWaiting(); // Activate new SW immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Take control of all pages immediately
});
