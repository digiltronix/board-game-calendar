<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="7">
      <v-card>
        <v-card-title class="page-card-title">
          <div class="d-flex align-center">
            <v-icon color="primary" class="mr-3 flex-shrink-0"
              >$fileDocumentOutline</v-icon
            >
            <h1 class="page-title">Terms of service</h1>
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6 legal">
          <p class="legal-updated">Last updated: 27 June 2026</p>

          <p>
            These terms govern your use of Board Game Calendar ("BGC"), a
            personal, non-commercial project operated by Jason Suttles. By using
            BGC you agree to them. If you don't agree, please don't use the
            service.
          </p>

          <h2 class="legal-h2">The service</h2>
          <p>
            BGC is a free tool for scheduling board game nights — cataloguing
            games, connecting with friends, and organising gatherings. It is
            provided as-is and may change or pause at any time. It is a hobby
            project, not a commercial product, and carries no uptime guarantee.
          </p>

          <h2 class="legal-h2">Eligibility</h2>
          <p>
            You must be at least 16 years old to use BGC. By using it you confirm
            that the information you provide is accurate and that you may legally
            agree to these terms.
          </p>

          <h2 class="legal-h2">Your account</h2>
          <p>
            You're responsible for activity under your account and for keeping
            your sign-in secure. Sign-in is handled by Google, Facebook, or
            email through Firebase Authentication.
          </p>

          <h2 class="legal-h2">Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>harass, threaten, impersonate, or abuse other members;</li>
            <li>
              misuse other people's information — including the addresses or
              phone numbers shared to host a game night — or contact them for
              anything other than the gathering at hand;
            </li>
            <li>
              scrape, bulk-collect, or attempt to enumerate other members'
              profiles;
            </li>
            <li>
              try to break, overload, or circumvent the security of the service;
              or
            </li>
            <li>use BGC for anything unlawful.</li>
          </ul>

          <h2 class="legal-h2">Your content</h2>
          <p>
            You keep ownership of the content you add (your collection, notes,
            gatherings, and so on). You grant us the limited permission needed to
            store and display it so the service can work. You're responsible for
            what you post and for having the right to share it.
          </p>

          <h2 class="legal-h2">Third-party services</h2>
          <p>
            BGC relies on Google Firebase, Facebook Login, Resend (email), and
            BoardGameGeek data. Your use of those sign-in providers is also
            subject to their own terms.
          </p>

          <h2 class="legal-h2">No warranty</h2>
          <p>
            BGC is provided "as is" and "as available", without warranties of any
            kind. We don't guarantee it will be uninterrupted, error-free, or
            that data will never be lost. Keep your own copy of anything
            important.
          </p>

          <h2 class="legal-h2">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, the operator is not liable
            for any indirect, incidental, or consequential damages arising from
            your use of BGC. As a free service, our total liability is limited to
            the maximum extent the law allows.
          </p>

          <h2 class="legal-h2">Termination</h2>
          <p>
            You can stop using BGC and request account deletion at any time. We
            may suspend or remove accounts that breach these terms or put the
            service or its members at risk.
          </p>

          <h2 class="legal-h2">Changes</h2>
          <p>
            We may update these terms and will revise the date above. Continuing
            to use BGC after a change means you accept the updated terms.
          </p>

          <h2 class="legal-h2">Contact</h2>
          <p>
            Jason Suttles —
            <a href="mailto:privacy@jasonsuttles.dev">privacy@jasonsuttles.dev</a>.
          </p>

          <p class="mt-6">
            <NuxtLink :to="routes.privacy" class="legal-inline-link"
              >Privacy policy →</NuxtLink
            >
          </p>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import routes from '~/helpers/routes'

useHead({ title: 'Terms of service' })
</script>

<style scoped>
.legal {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.96rem;
  line-height: 1.7;
  color: #e8d4a8;
}

.legal-updated {
  color: rgba(240, 223, 196, 0.7);
  font-size: 0.85rem;
  margin-bottom: 1.25rem;
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
</style>
