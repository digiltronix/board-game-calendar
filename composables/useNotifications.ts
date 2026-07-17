import { ref, computed } from 'vue'
import { ref as dbRef, get, update, remove } from 'firebase/database'
import { getApp } from 'firebase/app'

export type NotificationPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported'

// Keyed by the FCM registration token itself (RTDB keys forbid only
// '.', '#', '$', '[', ']', '/', none of which appear in an FCM token) so
// re-enabling on the same device overwrites the same entry rather than
// piling up duplicates. Value is the epoch-ms write time — enough for a
// possible future stale-token sweep, nothing more.
function tokenPath(uid: string, token: string): string {
  return `users/${uid}/fcmTokens/${token}`
}

const supported =
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator

const permission = ref<NotificationPermissionState>(
  supported
    ? (Notification.permission as NotificationPermissionState)
    : 'unsupported'
)

// Whether *this account* has a saved token anywhere — distinct from browser
// `permission`, which the browser never lets us revoke programmatically, so
// it stays 'granted' even after the user hits "Turn off" here. Module-scoped
// (like `permission`) so every component sees the same state.
const tokenSaved = ref(false)
// The uid the one-time fcmTokens existence check below was last run for —
// re-runs whenever the signed-in account changes (uid, not just a boolean),
// so switching accounts in the same SPA session without a reload doesn't
// keep showing the previous account's push status.
let statusCheckedForUid: string | null = null

// This device's current FCM token, once known (set by enable(), read by
// disable() so it doesn't need to ask FCM again just to learn what to
// delete). Not persisted — a reload starts this back at null, and disable()
// falls back to asking FCM for it in that case.
const currentToken = ref<string | null>(null)

// Module-scoped so the foreground listener is attached at most once per
// page load regardless of how many components call useNotifications().
let foregroundListenerAttached = false

async function attachForegroundListener() {
  if (foregroundListenerAttached || !supported) return
  foregroundListenerAttached = true
  const { getMessaging, onMessage } = await import('firebase/messaging')
  const messaging = getMessaging(getApp())
  // The service worker's onBackgroundMessage only fires while the app isn't
  // focused; when it is, Firebase delivers here instead — surface it as a
  // native notification rather than plumbing a global toast bus through
  // every page just for this one background/foreground split.
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'Board Game Calendar'
    const link = payload.fcmOptions?.link ?? payload.data?.link ?? '/'
    const notification = new Notification(title, {
      body: payload.notification?.body,
      icon: '/icons/icon-192.png',
    })
    // A native Notification click fires outside any Vue/Nuxt component
    // context, so this uses a plain navigation rather than navigateTo() (the
    // service worker's notificationclick handler does the same for the
    // background-message case).
    notification.onclick = () => {
      window.focus()
      window.location.href = link
    }
  })
}

export function useNotifications() {
  const nuxtApp = useNuxtApp()
  const db = nuxtApp.$db
  const userStore = useUserStore()
  const runtimeConfig = useRuntimeConfig()
  const enabling = ref(false)

  const enabled = computed(() => permission.value === 'granted' && tokenSaved.value)

  const uid = userStore.user?.uid
  if (supported && permission.value === 'granted' && uid) {
    // Already granted from a previous visit — reattach the foreground
    // listener (no new permission prompt, nothing written) so pushes still
    // surface while the tab is focused, and check whether a token is still
    // on file so the "Turn off" state is accurate. Both no-op once already
    // done for this uid.
    attachForegroundListener()
    if (statusCheckedForUid !== uid) {
      statusCheckedForUid = uid
      get(dbRef(db, `users/${uid}/fcmTokens`)).then((snap) => {
        tokenSaved.value = snap.exists()
      })
    }
  } else if (!uid && statusCheckedForUid !== null) {
    // Signed out — clear so a different account signing in next is checked
    // from scratch instead of inheriting this account's last known status.
    statusCheckedForUid = null
    tokenSaved.value = false
  }

  async function enable(): Promise<boolean> {
    if (!supported) return false
    if (!runtimeConfig.public.fcmVapidKey) {
      console.error('FCM_VAPID_KEY is not configured')
      return false
    }
    enabling.value = true
    try {
      const result = await Notification.requestPermission()
      permission.value = result as NotificationPermissionState
      if (result !== 'granted') return false

      const registration = await useServiceWorker().register()
      if (!registration) return false

      const { getMessaging, getToken } = await import('firebase/messaging')
      const messaging = getMessaging(getApp())
      const token = await getToken(messaging, {
        vapidKey: runtimeConfig.public.fcmVapidKey,
        serviceWorkerRegistration: registration,
      })
      if (!token) return false

      const uid = userStore.user!.uid
      await update(dbRef(db), { [tokenPath(uid, token)]: Date.now() })
      currentToken.value = token
      tokenSaved.value = true
      await attachForegroundListener()
      return true
    } finally {
      enabling.value = false
    }
  }

  // Stops this device from receiving pushes by deleting its stored token.
  // Browser notification permission itself can only be revoked by the user
  // via browser settings — there's no programmatic API for that, so
  // `permission` stays 'granted' and `tokenSaved` is what flips instead.
  // Returns false (and leaves `tokenSaved` untouched) when the token can't be
  // determined, rather than reporting success it can't back up — otherwise a
  // transient getToken() failure would show "notifications off" while the
  // real token is still on file and the device keeps receiving pushes.
  async function disable(): Promise<boolean> {
    if (!supported) return false
    const uid = userStore.user?.uid
    if (!uid) return false

    let token = currentToken.value
    if (!token) {
      // Not known from this session (e.g. the page was reloaded after
      // enabling) — ask FCM for the current one so there's something to
      // delete rather than guessing.
      if (!runtimeConfig.public.fcmVapidKey) return false
      const registration = await useServiceWorker().register()
      if (!registration) return false
      const { getMessaging, getToken } = await import('firebase/messaging')
      const messaging = getMessaging(getApp())
      token = await getToken(messaging, {
        vapidKey: runtimeConfig.public.fcmVapidKey,
        serviceWorkerRegistration: registration,
      }).catch(() => null)
    }
    if (!token) return false

    await remove(dbRef(db, tokenPath(uid, token)))
    currentToken.value = null
    tokenSaved.value = false
    return true
  }

  return { permission, enabled, enabling, supported, enable, disable }
}
