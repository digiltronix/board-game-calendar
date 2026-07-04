<template>
  <v-row justify="center" align="center">
    <v-col cols="12" sm="8" md="5">
      <div class="text-center mb-6">
        <BGCLogoIcon :size="52" class="mb-2" />
        <h1 class="signin-title">Welcome back</h1>
        <p class="signin-subtitle">Sign in to manage your game nights</p>
      </div>
      <v-card class="pa-2">
        <v-card-text>
          <v-btn
            block
            size="large"
            class="mb-3 social-btn google-btn"
            :loading="isLoading"
            @click="signInWithGoogle"
          >
            <v-icon start>$google</v-icon>
            Continue with Google
          </v-btn>
          <v-btn
            block
            size="large"
            class="mb-3 social-btn facebook-btn"
            :loading="isLoading"
            @click="signInWithFacebook"
          >
            <v-icon start>$facebook</v-icon>
            Continue with Facebook
          </v-btn>
          <p class="signin-terms">
            By continuing, you agree to the
            <NuxtLink :to="routes.terms">terms of service</NuxtLink> and
            acknowledge the
            <NuxtLink :to="routes.privacy">privacy policy</NuxtLink>.
          </p>
        </v-card-text>
      </v-card>
      <Snackbar ref="snackbar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth'
import Snackbar from '~/components/Snackbar.vue'
import routes from '~/helpers/routes'

useHead({ title: 'Sign in' })

const userStore = useUserStore()
const router = useRouter()

const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)

const { isLoading, errorMessage, handleOAuthSignIn } = useAuthSignIn()

watch(errorMessage, (message) => {
  if (message) {
    snackbar.value?.showSnackbarWithMessage(message, true)
    errorMessage.value = null
  }
})

onMounted(() => {
  if (userStore.user) {
    router.push(routes.gameCollection)
  }
})

const signInWithGoogle = () => handleOAuthSignIn(new GoogleAuthProvider())
const signInWithFacebook = () => handleOAuthSignIn(new FacebookAuthProvider())
</script>

<style scoped>
.signin-title {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #f0dfc4;
}

.signin-subtitle {
  font-family: 'Lora', Georgia, serif;
  font-size: 1rem;
  color: rgba(240, 223, 196, 0.8);
}

.social-btn {
  font-weight: 500;
  border: 1px solid rgba(200, 134, 10, 0.22);
  transition: all 0.25s ease;
}

.social-btn:hover {
  border-color: rgba(200, 134, 10, 0.4);
  background: rgba(200, 134, 10, 0.07) !important;
}

.google-btn,
.facebook-btn {
  color: #e8d4a8;
}

.signin-terms {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.82rem;
  line-height: 1.55;
  text-align: center;
  color: rgba(240, 223, 196, 0.8);
  margin: 4px 4px 0;
}

.signin-terms a {
  color: #c0a870;
  text-decoration: underline;
}
</style>
