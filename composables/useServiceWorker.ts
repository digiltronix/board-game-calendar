import firebaseConf from '~/firebase.config'

// Module-scoped so every caller (the early registration plugin, and later
// useNotifications.ts requesting a token) shares one registration instead of
// racing separate register() calls.
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null

// Registers public/firebase-messaging-sw.js at the app's baseURL scope. This
// single service worker backs two unrelated concerns: it's what makes the
// app installable on Android/Chrome (a controlling service worker is one of
// the beforeinstallprompt criteria — see useInstallPrompt.ts), and it's the
// Firebase Messaging background-push handler. Firebase config isn't secret
// (see the comment in public/firebase-messaging-sw.js) but public/ files
// aren't Vite-processed, so apiKey/appId travel as query params rather than
// being templated into the file at build time.
export function useServiceWorker() {
  function register(): Promise<ServiceWorkerRegistration | null> {
    if (registrationPromise) return registrationPromise
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      registrationPromise = Promise.resolve(null)
      return registrationPromise
    }
    const { app } = useRuntimeConfig()
    const params = new URLSearchParams({
      apiKey: firebaseConf.apiKey,
      appId: firebaseConf.appId,
    })
    registrationPromise = navigator.serviceWorker
      .register(`${app.baseURL}firebase-messaging-sw.js?${params.toString()}`)
      .catch((err) => {
        console.error('Service worker registration failed', err)
        return null
      })
    return registrationPromise
  }

  return { register }
}
