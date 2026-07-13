import { ref, computed } from 'vue'

// beforeinstallprompt is Chromium-only (Android Chrome, desktop Chrome/Edge)
// — there's no equivalent on iOS Safari, so this composable's canInstall is
// simply always false there, and the profile page section stays hidden.
// Module-scoped state + a single listener (attached by the boot-time plugin,
// plugins/05-install-prompt.client.ts) so the event — which Chrome fires once
// per qualifying page load, not on demand — is captured even if the user
// hasn't visited /profile yet when it fires.
type BeforeInstallPromptEvent = Event & {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)
let listenersAttached = false

export function attachInstallPromptListeners() {
  if (listenersAttached || typeof window === 'undefined') return
  listenersAttached = true
  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    installed.value = true
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferredPrompt.value = null
  })
}

export function useInstallPrompt() {
  const canInstall = computed(
    () => deferredPrompt.value !== null && !installed.value
  )

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const evt = deferredPrompt.value
    if (!evt) return 'unavailable'
    evt.prompt()
    const choice = await evt.userChoice
    deferredPrompt.value = null
    return choice.outcome
  }

  return { canInstall, installed, promptInstall }
}
