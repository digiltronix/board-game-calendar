// Registered at the origin root so its scope covers the whole app (required
// both for Firebase Cloud Messaging background push and, more generally, for
// Android/Chrome's install-prompt criteria — a controlling service worker is
// one of them). Firebase config isn't build-processed here (public/ files
// are copied as-is, not run through Vite), so the client passes it as query
// params when it registers this file — see composables/useServiceWorker.ts.
//
// The SDK version below is pinned separately from package.json's `firebase`
// dependency (this file loads it from a CDN, not the npm package) — there's
// no build step linking the two, so bump both together by hand when either
// changes.
importScripts(
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js'
)
importScripts(
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js'
)

const params = new URLSearchParams(self.location.search)
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: 'board-game-calendar-3ae94.firebaseapp.com',
  projectId: 'board-game-calendar-3ae94',
  databaseURL:
    'https://board-game-calendar-3ae94-default-rtdb.firebaseio.com/',
  storageBucket: 'board-game-calendar-3ae94.firebasestorage.app',
  messagingSenderId: '800434247259',
  appId: params.get('appId'),
}

// This registers unconditionally on every page load, for every visitor, so
// that the app meets the install-prompt criteria (see
// plugins/04-service-worker.client.ts) — apiKey/appId are present from the
// very first registration, not gated on notification opt-in. That's fine:
// initializeApp()/messaging() below only construct local objects and attach
// a 'push' listener — no network call, no Firebase Installation, and no data
// collection happens until a client actually calls getToken() (which *is*
// gated behind the user opting in on /profile — see useNotifications.ts).
if (firebaseConfig.apiKey && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig)

  const messaging = firebase.messaging()

  // Fires only while the app isn't in the foreground (onMessage in
  // useNotifications.ts handles the foreground case with an in-app toast).
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'Board Game Calendar'
    const link = payload.fcmOptions?.link ?? payload.data?.link ?? '/'
    self.registration.showNotification(title, {
      body: payload.notification?.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { link },
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link ?? '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(link)
            return client.focus()
          }
        }
        return self.clients.openWindow(link)
      })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
