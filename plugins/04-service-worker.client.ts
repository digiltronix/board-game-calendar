// Registers the service worker as early as possible so the app meets the
// Android/Chrome install-prompt criteria (a controlling service worker is
// one of them) as soon as a visitor lands, not only once they opt into
// notifications on /profile. See composables/useServiceWorker.ts.
//
// Also reattaches the foreground push listener on every boot when
// notification permission was already granted in an earlier session — that
// listener otherwise only (re)attaches as a side effect of calling
// useNotifications(), which without this would mean pushes only surface
// while the tab is focused if the user happens to be on /profile. See
// composables/useNotifications.ts.
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    useServiceWorker().register()
    useNotifications()
  }
})
