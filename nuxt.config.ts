import { fileURLToPath } from 'node:url'
import { mdiSvgAliases } from './vuetify.icons'

const SCREENSHOT_MODE = process.env.NUXT_PUBLIC_SCREENSHOT_MODE === 'true'

function mockAlias(name: string) {
  return fileURLToPath(new URL(`./helpers/screenshot/${name}`, import.meta.url))
}

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-01-01',

  css: ['~/assets/global.scss'],

  app: {
    baseURL: process.env.BASE_URL ?? '/',
    head: {
      titleTemplate: '%s - Board Game Calendar',
      title: 'Board Game Calendar',
      htmlAttrs: { lang: 'en' },
      style: [
        { innerHTML: 'html,body{background-color:#0E1A12}', type: 'text/css' },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0E1A12' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        {
          name: 'description',
          content:
            'Schedule board game nights with friends around the games you love.',
        },
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/png',
          href: `${process.env.BASE_URL ?? '/'}favicon.png`,
        },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: `${process.env.BASE_URL ?? '/'}favicon.svg`,
        },
        {
          rel: 'manifest',
          href: `${process.env.BASE_URL ?? '/'}manifest.webmanifest`,
        },
        {
          rel: 'apple-touch-icon',
          href: `${process.env.BASE_URL ?? '/'}icons/icon-192.png`,
        },
        { rel: 'preconnect', href: 'https://identitytoolkit.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://board-game-calendar-3ae94-default-rtdb.firebaseio.com',
        },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'preload',
          as: 'style',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
          onload: "this.onload=null;this.rel='stylesheet'",
        },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  modules: ['@pinia/nuxt', 'vuetify-nuxt-module', '@nuxt/eslint'],

  vuetify: {
    moduleOptions: {
      styles: { configFile: './assets/variables.scss' },
    },
    vuetifyOptions: {
      // Tree-shaken SVG icons: only the aliases registered in vuetify.icons.ts
      // ship in the bundle. Reference icons as $aliasName (never mdi-* font
      // classes — the icon font is not installed).
      icons: {
        defaultSet: 'mdi-svg',
        svg: { mdi: { aliases: mdiSvgAliases } },
      },
      theme: {
        defaultTheme: 'dark',
        themes: {
          dark: {
            dark: true,
            colors: {
              background: '#0E1A12',
              surface: '#20140A',
              'surface-variant': '#2A1A0B',
              primary: '#C8860A',
              'primary-darken-1': '#9A640A',
              secondary: '#4A7A44',
              'secondary-darken-1': '#356030',
              accent: '#C0A870',
              info: '#5B8FAB',
              warning: '#D4A820',
              error: '#E05252',
              success: '#55B855',
              'on-background': '#F0DFC4',
              'on-surface': '#E8D4A8',
              'on-primary': '#100A04',
              'on-secondary': '#F0DFC4',
            },
          },
        },
      },
      defaults: {
        VBtn: {
          rounded: 'lg',
          variant: 'elevated',
        },
        VCard: {
          rounded: 'xl',
        },
        VTextField: {
          variant: 'outlined',
          density: 'comfortable',
        },
        VTextarea: {
          variant: 'outlined',
          density: 'comfortable',
        },
        VAutocomplete: {
          variant: 'outlined',
          density: 'comfortable',
        },
        VProgressLinear: {
          rounded: true,
        },
      },
    },
  },

  runtimeConfig: {
    public: {
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY ?? '',
      fcmVapidKey: process.env.FCM_VAPID_KEY ?? '',
      screenshotMode: SCREENSHOT_MODE,
    },
  },

  vite: {
    css: {
      transformer: 'lightningcss',
    },
    build: {
      cssMinify: 'lightningcss',
    },
    resolve: {
      alias: SCREENSHOT_MODE
        ? {
            'firebase/analytics': mockAlias('firebase-analytics.ts'),
            'firebase/app-check': mockAlias('firebase-app-check.ts'),
            'firebase/auth': mockAlias('firebase-auth.ts'),
            'firebase/database': mockAlias('firebase-database.ts'),
            'firebase/functions': mockAlias('firebase-functions.ts'),
            'firebase/messaging': mockAlias('firebase-messaging.ts'),
          }
        : {},
    },
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'awesome-phonenumber',
        // Omit firebase/* in screenshot mode — they are aliased to local mocks
        ...(SCREENSHOT_MODE
          ? []
          : [
              'firebase/analytics',
              'firebase/app',
              'firebase/auth',
              'firebase/database',
            ]),
        'validator/lib/isEmail', // CJS
      ],
    },
    define: {
      'process.env.G_API_KEY': JSON.stringify(process.env.G_API_KEY ?? ''),
      'process.env.G_APP_ID': JSON.stringify(process.env.G_APP_ID ?? ''),
      'process.env.RECAPTCHA_SITE_KEY': JSON.stringify(
        process.env.RECAPTCHA_SITE_KEY ?? ''
      ),
    },
  },
})
