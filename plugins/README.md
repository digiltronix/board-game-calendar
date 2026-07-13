# Plugins

Nuxt plugins run before the Vue app mounts. They are loaded in filename order.

## 01-firebase.client.ts

Initializes the Firebase app and provides the following to `useNuxtApp()`:

- `$db` — Firebase Realtime Database instance
- `$auth` — Firebase Auth instance
- `$logEvent` — wrapper around Firebase Analytics `logEvent`
- `$log` — structured logger that routes through `$logEvent`

Types for these are declared in `helpers/nuxt.d.ts`.

**Analytics is consent-gated.** `firebase/analytics` is not imported until the
visitor accepts the cookie banner. The plugin watches `useCookieConsent().consent`
and only calls `getAnalytics()` when consent is `'granted'` (and
`setAnalyticsCollectionEnabled(false)` if later denied). Until then `$logEvent`
no-ops, so no analytics cookies or gtag script load. App Check/reCAPTCHA and the
auth session are strictly-necessary and stay on regardless.

## 02-fireauth.client.ts

Runs after `01-firebase.client.ts`. Waits for Firebase Auth to resolve the initial auth state before the app renders, ensuring `useUserStore().user` is populated on first load.

## 04-service-worker.client.ts

Registers `public/firebase-messaging-sw.js` unconditionally on load via `useServiceWorker()` (`composables/useServiceWorker.ts`), unrelated to cookie consent — a controlling service worker is one of the Android/Chrome install-prompt criteria (see `composables/useInstallPrompt.ts`), so this needs to happen before the visitor ever opts into anything. The same registration is reused by `useNotifications.ts` when the user later enables push notifications on `/profile`. Also calls `useNotifications()` so the foreground push listener reattaches on boot when permission was already granted in an earlier session, not only while the user happens to be on `/profile`.

## 05-install-prompt.client.ts

Attaches the `beforeinstallprompt`/`appinstalled` listeners backing `useInstallPrompt.ts` as early as possible, since Chrome fires `beforeinstallprompt` once per qualifying page load rather than on demand.
