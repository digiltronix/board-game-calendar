<template>
  <v-app>
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <v-navigation-drawer v-model="drawer" aria-label="Main navigation">
      <div class="drawer-header">
        <BGCLogo />
        <div class="drawer-brand">BGC</div>
      </div>
      <v-divider class="mb-2" />
      <v-list nav class="nav-list">
        <v-list-item
          v-for="(item, i) in activeItems"
          :key="i"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          exact
          min-height="56"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar class="bgc-app-bar" flat>
      <v-app-bar-nav-icon
        aria-label="Open navigation menu"
        @click.stop="drawer = !drawer"
      />
      <v-toolbar-title class="app-bar-title">
        <BGCLogoIcon :size="22" class="app-bar-title-icon" />
        <span class="d-none d-sm-inline">{{ title }}</span>
        <span class="d-inline d-sm-none">BGC</span>
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        v-if="showSignOut"
        class="d-sm-none"
        variant="elevated"
        color="primary"
        icon
        size="small"
        aria-label="Sign out"
        title="Sign out"
        @click.stop="onSignoutClicked"
      >
        <v-icon>$logout</v-icon>
      </v-btn>
      <v-btn
        v-if="showSignOut"
        class="d-none d-sm-flex"
        variant="elevated"
        color="primary"
        size="small"
        @click.stop="onSignoutClicked"
      >
        <v-icon start>$logout</v-icon>Sign out
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container id="main-content">
        <slot />
      </v-container>
    </v-main>

    <v-footer app class="bgc-footer">
      <div class="footer-inner">
        <span>Jason Suttles &copy; {{ new Date().getFullYear() }}</span>
        <nav class="footer-links" aria-label="Legal">
          <NuxtLink :to="routes.privacy">Privacy</NuxtLink>
          <NuxtLink :to="routes.terms">Terms</NuxtLink>
          <button type="button" class="footer-link-btn" @click="reopen">
            Cookie settings
          </button>
        </nav>
      </div>
    </v-footer>

    <CookieConsent />
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import routes from '~/helpers/routes'

enum PageType {
  AlwaysShow,
  NeedsAuth,
  BeforeAuth,
}

const userStore = useUserStore()
const router = useRouter()
const { reopen } = useCookieConsent()

const title = 'Board Game Calendar'
const drawer = ref(false)

const items = [
  {
    icon: '$castle',
    title: 'Welcome',
    to: routes.index,
    type: PageType.AlwaysShow,
  },
  {
    icon: '$accountKey',
    title: 'Sign in',
    to: routes.signIn,
    type: PageType.BeforeAuth,
  },
  {
    icon: '$calendarMonth',
    title: 'Calendar',
    to: routes.calendar,
    type: PageType.NeedsAuth,
  },
  {
    icon: '$diceMultiple',
    title: 'New gathering',
    to: routes.newGathering,
    type: PageType.NeedsAuth,
  },
  {
    icon: '$cardsOutline',
    title: 'Game collection',
    to: routes.gameCollection,
    type: PageType.NeedsAuth,
  },
  {
    icon: '$accountGroup',
    title: 'Friends',
    to: routes.friends,
    type: PageType.NeedsAuth,
  },
  {
    icon: '$account',
    title: 'Profile',
    to: routes.profile,
    type: PageType.NeedsAuth,
  },
]

const activeItems = computed(() => {
  if (userStore.user) {
    return items.filter((item) =>
      [PageType.AlwaysShow, PageType.NeedsAuth].includes(item.type)
    )
  }
  return items.filter((item) =>
    [PageType.AlwaysShow, PageType.BeforeAuth].includes(item.type)
  )
})

const showSignOut = computed(() => !!userStore.user)

async function onSignoutClicked() {
  await userStore.signOut()
  await router.push(routes.signIn)
}
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px 14px;
  border-bottom: 1px solid rgba(200, 134, 10, 0.14);
}

.drawer-brand {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #c8860a;
  text-shadow: 0 0 14px rgba(200, 134, 10, 0.4);
}

.app-bar-title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #f0dfc4;
}

.app-bar-title-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.nav-list :deep(.v-list-item-title) {
  font-family: 'Lora', Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.4;
}

.nav-list :deep(.v-icon) {
  font-size: 1.3rem;
  color: rgba(200, 134, 10, 0.7);
}

.nav-list :deep(.v-list-item--active .v-icon) {
  color: #c8860a;
}

.footer-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 16px;
  width: 100%;
  font-size: 0.82rem;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.footer-links a,
.footer-link-btn {
  color: rgba(240, 223, 196, 0.78);
  text-decoration: underline;
  font-size: 0.82rem;
}

.footer-link-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}

.footer-links a:hover,
.footer-link-btn:hover {
  color: #c8860a;
}
</style>
