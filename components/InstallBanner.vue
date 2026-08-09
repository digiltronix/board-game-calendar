<template>
  <Transition name="install-banner-fade">
    <div
      v-if="show"
      class="install-banner"
      role="region"
      aria-label="Install app"
    >
      <div class="install-banner__inner">
        <v-icon color="primary" class="install-banner__icon"
          >$cellphoneArrowDown</v-icon
        >
        <p class="install-banner__text">
          Install Board Game Calendar on this device for quicker, full-screen
          access.
        </p>
        <div class="install-banner__actions">
          <v-btn
            variant="flat"
            color="surface-variant"
            size="small"
            @click="onDismiss"
          >
            Not now
          </v-btn>
          <v-btn variant="flat" color="primary" size="small" @click="onInstall">
            Install
          </v-btn>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const { showBanner, promptInstall, dismissBanner } = useInstallPrompt()
const { hasResponded: cookieConsentAnswered } = useCookieConsent()

// Decide visibility only after mount (avoids an SSR/hydration mismatch —
// beforeinstallprompt is client-only) and defer to the cookie consent banner
// so the two fixed bottom banners never stack on a first-time visit.
const mounted = ref(false)

// Desktop Chrome/Edge already surface an install icon in the address bar,
// so the proactive banner is mobile-only; desktop users still have the
// Profile page's "Install app" button (unaffected by this check). Matches
// the same < md (960px) split the game-item list layout uses for its own
// mobile/desktop switch.
const MOBILE_QUERY = '(max-width: 959px)'
const isMobileViewport = ref(false)
let mediaQuery: MediaQueryList | null = null
function onMediaChange(e: MediaQueryListEvent) {
  isMobileViewport.value = e.matches
}

onMounted(() => {
  mounted.value = true
  mediaQuery = window.matchMedia(MOBILE_QUERY)
  isMobileViewport.value = mediaQuery.matches
  mediaQuery.addEventListener('change', onMediaChange)
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', onMediaChange)
})

const show = computed(
  () =>
    mounted.value &&
    isMobileViewport.value &&
    cookieConsentAnswered.value &&
    showBanner.value
)

const onInstall = () => promptInstall()
const onDismiss = () => dismissBanner()
</script>

<style scoped>
.install-banner {
  position: fixed;
  inset: auto 12px 12px 12px;
  z-index: 2300;
  margin: 0 auto;
  max-width: 720px;
  background: #241808;
  border: 1px solid rgba(200, 134, 10, 0.32);
  border-radius: 12px;
  box-shadow: 0 20px 44px -16px rgba(0, 0, 0, 0.7);
}

.install-banner__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 16px 20px;
}

.install-banner__icon {
  flex: 0 0 auto;
}

.install-banner__text {
  flex: 1 1 280px;
  margin: 0;
  font-family: 'Lora', Georgia, serif;
  font-size: 0.9rem;
  line-height: 1.55;
  color: #e8d4a8;
}

.install-banner__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.install-banner-fade-enter-active,
.install-banner-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.install-banner-fade-enter-from,
.install-banner-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
