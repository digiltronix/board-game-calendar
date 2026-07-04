<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="7">
      <v-card>
        <v-card-title class="page-card-title">
          <div class="d-flex align-center">
            <v-icon color="primary" class="mr-3 flex-shrink-0"
              >$accountRemoveOutline</v-icon
            >
            <h1 class="page-title">Data deletion</h1>
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6 legal">
          <div v-if="code" class="confirmation">
            <p>
              Your data deletion request has been received. We've erased the
              personal data associated with the account linked to it.
            </p>
            <p class="confirmation-code">
              Reference code: <strong>{{ code }}</strong>
            </p>
            <p>
              Keep this code if you'd like to ask us about the request. Questions?
              Email
              <a href="mailto:privacy@jasonsuttles.dev"
                >privacy@jasonsuttles.dev</a
              >.
            </p>
          </div>

          <h2 class="legal-h2">How to delete your account and data</h2>
          <p>
            You can have everything we hold about you removed at any time, in any
            of these ways:
          </p>
          <ul>
            <li>
              <strong>In the app</strong> — sign in and clear your profile, then
              email us (below) to remove the account itself.
            </li>
            <li>
              <strong>By email</strong> — write to
              <a href="mailto:privacy@jasonsuttles.dev"
                >privacy@jasonsuttles.dev</a
              >
              from the address on your account and we'll delete it within a
              reasonable time.
            </li>
            <li>
              <strong>Through Facebook</strong> — if you signed in with Facebook,
              removing Board Game Calendar from your Facebook
              <a
                href="https://www.facebook.com/settings?tab=applications"
                target="_blank"
                rel="noopener noreferrer"
                >app settings</a
              >
              triggers an automatic deletion request, and Facebook shows you a
              confirmation code that links back to this page.
            </li>
          </ul>

          <h2 class="legal-h2">What gets deleted</h2>
          <p>
            We remove your profile, your game collection and notes, your friends
            and friend requests, and the gatherings you host. Gatherings you were
            only invited to have your entry removed. Backups and security logs may
            persist briefly before rotating out.
          </p>

          <p class="mt-6">
            <NuxtLink :to="routes.privacy" class="legal-inline-link"
              >← Back to the privacy policy</NuxtLink
            >
          </p>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import routes from '~/helpers/routes'

useHead({ title: 'Data deletion' })

const route = useRoute()
const code = computed(() => {
  const c = route.query.code
  const value = Array.isArray(c) ? c[0] : c
  // Only echo a plausible confirmation code (hex), never arbitrary query text.
  return typeof value === 'string' && /^[a-f0-9]{8,32}$/.test(value)
    ? value
    : ''
})
</script>

<style scoped>
.legal {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.96rem;
  line-height: 1.7;
  color: #e8d4a8;
}

.legal p {
  margin-bottom: 1rem;
}

.legal ul {
  margin: 0 0 1rem 1.1rem;
  padding: 0;
}

.legal li {
  margin-bottom: 0.5rem;
}

.legal-h2 {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: #c8860a;
  margin: 1.6rem 0 0.6rem;
}

.legal a,
.legal-inline-link {
  color: #c0a870;
  text-decoration: underline;
}

.confirmation {
  border: 1px solid rgba(85, 184, 85, 0.4);
  background: rgba(85, 184, 85, 0.08);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 0.5rem;
}

.confirmation-code {
  font-family: 'Lora', Georgia, serif;
  letter-spacing: 0.02em;
}
</style>
