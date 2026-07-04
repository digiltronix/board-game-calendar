<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="6">
      <v-card>
        <v-card-title class="d-flex align-center pa-6">
          <v-icon color="primary" class="mr-3">$accountCircle</v-icon>
          <h1 class="page-title">Profile</h1>
          <v-spacer />
          <v-btn
            v-if="!editable && !loading"
            variant="elevated"
            color="primary"
            size="small"
            @click.stop="editable = true"
          >
            <v-icon start>$pencil</v-icon>Edit
          </v-btn>
          <v-btn
            v-if="editable"
            variant="elevated"
            color="success"
            size="small"
            @click.stop="updateProfile"
          >
            <v-icon start>$contentSave</v-icon>Save
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text v-if="loading" class="pa-8">
          <v-progress-linear
            indeterminate
            color="primary"
            aria-label="Loading profile"
          />
        </v-card-text>
        <v-card-text v-else-if="editable" class="pa-6">
          <v-form ref="profileForm">
            <v-text-field
              v-model="profile.name"
              :label="labels.name"
              :rules="[validation.isRequired]"
              prepend-inner-icon="$accountOutline"
              class="mb-1"
            />
            <v-text-field
              v-model="profile.phoneNumber"
              :label="labels.phoneNumber"
              :rules="[validation.isPhone]"
              prepend-inner-icon="$phoneOutline"
              class="mb-1"
            />
            <v-text-field
              :model-value="authEmail ?? ''"
              :label="labels.email"
              disabled
              hint="Email comes from your sign-in account"
              persistent-hint
              prepend-inner-icon="$emailOutline"
              class="mb-1"
            />
            <v-textarea
              v-model="profile.address"
              :label="labels.address"
              prepend-inner-icon="$mapMarkerOutline"
              rows="3"
            />
            <v-text-field
              v-model="profile.maxPeople"
              type="number"
              :label="labels.maxPeople"
              :rules="[validation.isMaxPeople]"
              prepend-inner-icon="$accountMultipleOutline"
            />
          </v-form>
        </v-card-text>
        <v-card-text v-else class="pa-6">
          <div class="profile-fields">
            <div
              v-for="field in profileFields"
              :key="field.icon"
              class="profile-field"
            >
              <v-icon size="20" color="primary" class="profile-field-icon">{{
                field.icon
              }}</v-icon>
              <div>
                <div class="profile-field-label">{{ field.label }}</div>
                <div class="profile-field-value">
                  <template v-if="field.isAddress && profile.address">
                    <a
                      style="white-space: pre-wrap"
                      target="_blank"
                      rel="noopener noreferrer"
                      :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(removeNewLines(profile.address))}`"
                      class="address-link"
                      >{{ profile.address }}</a
                    >
                  </template>
                  <template v-else>{{ field.value || 'Not set' }}</template>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
      <Snackbar ref="snackbar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ref as dbRef, onValue, update } from 'firebase/database'
import { parsePhoneNumber } from 'awesome-phonenumber'
import Snackbar from '~/components/Snackbar.vue'
import helpers from '~/helpers/helpers'
import constants from '~/helpers/constants'
import type { FormInstance } from '~/helpers/types'

useHead({ title: 'Profile' })

// name lives in the public profiles/{uid} node; the rest under owner-only
// users/{uid}; email comes from the auth account and isn't stored directly
type UserProfile = {
  name: string
  phoneNumber: string
  address: string
  maxPeople: number
}

const labels = {
  name: 'Name',
  phoneNumber: 'Phone number',
  email: 'Email',
  address: 'Address',
  maxPeople: 'Max people at residence',
}

const userStore = useUserStore()
const nuxtApp = useNuxtApp()
const db = nuxtApp.$db
const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)
const profileForm = ref<FormInstance | null>(null)
const editable = ref(false)
const loading = ref(true)
const profile = reactive<UserProfile>({
  name: '',
  phoneNumber: '',
  address: '',
  maxPeople: 0,
})

const profileFields = computed(() => [
  { icon: '$account', label: labels.name, value: profile.name },
  { icon: '$phone', label: labels.phoneNumber, value: profile.phoneNumber },
  { icon: '$email', label: labels.email, value: authEmail.value ?? '' },
  {
    icon: '$mapMarker',
    label: labels.address,
    value: profile.address,
    isAddress: true,
  },
  {
    icon: '$accountMultipleCheck',
    label: labels.maxPeople,
    value: profile.maxPeople != null ? String(profile.maxPeople) : '',
  },
])

// the rules bind email/queryableEmail to the verified auth token, so the
// field is read-only and writes always use the auth account's email
const authEmail = computed(() => userStore.user?.email ?? null)

const validation = {
  isRequired: (v: string) => !!v || 'Required',
  isPhone: (v: string) =>
    !v ||
    parsePhoneNumber(v, { regionCode: 'US' }).valid ||
    'Invalid phone number',
  isMaxPeople: (v: number | string) =>
    v == null ||
    v === '' ||
    (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000) ||
    'Must be a whole number between 0 and 1000',
}

let unsubscribe: (() => void) | null = null
let unsubscribePublic: (() => void) | null = null
// the stored search email: written at sign-in once the address is verified;
// the save flow preserves it rather than recomputing (see updateProfile)
let storedQueryableEmail: string | null = null

onMounted(() => {
  const uid = userStore.user!.uid
  function showLoadError(err: unknown) {
    loading.value = false
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
  unsubscribe = onValue(
    dbRef(db, `users/${uid}`),
    (snapshot) => {
      const val = snapshot.val()
      if (val) Object.assign(profile, val)
      loading.value = false
    },
    showLoadError
  )
  unsubscribePublic = onValue(
    dbRef(db, `profiles/${uid}`),
    (snapshot) => {
      const val = snapshot.val()
      profile.name = val?.name ?? ''
      storedQueryableEmail = val?.queryableEmail ?? null
    },
    showLoadError
  )
  setTimeout(() => {
    loading.value = false
  }, constants.LoadingTimeoutInMs)
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribePublic?.()
})

function removeNewLines(str: string): string {
  return str.replace(/\n/g, ' ')
}

async function updateProfile() {
  try {
    const result = await profileForm.value?.validate()
    if (!result?.valid) return
    const uid = userStore.user!.uid
    const nationalPhone = profile.phoneNumber
      ? (parsePhoneNumber(profile.phoneNumber, { regionCode: 'US' }).number
          ?.national ?? null)
      : null
    // the public node is replaced wholesale (the form covers all its fields);
    // omitted keys — e.g. a cleared phone — are thereby deleted. The search
    // email is preserved as stored, not recomputed: the rules only accept a
    // *new* value from a freshly verified token, which sign-in handles
    const publicProfile: Record<string, string> = {
      name: profile.name,
      queryableName: profile.name.toLowerCase(),
    }
    if (storedQueryableEmail)
      publicProfile.queryableEmail = storedQueryableEmail
    if (nationalPhone)
      publicProfile.queryablePhone = nationalPhone.replace(/\D/g, '')
    await update(dbRef(db), {
      [`profiles/${uid}`]: publicProfile,
      [`users/${uid}/phoneNumber`]: nationalPhone,
      [`users/${uid}/address`]: profile.address,
      // v-text-field type="number" still models a string; rules require a number
      [`users/${uid}/maxPeople`]:
        profile.maxPeople != null && `${profile.maxPeople}` !== ''
          ? Number(profile.maxPeople)
          : null,
    })
    editable.value = false
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}
</script>

<style scoped>
.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.profile-field {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.profile-field-icon {
  margin-top: 2px;
  opacity: 0.9;
}
.profile-field-label {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 0.8rem;
  color: #c8860a;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  margin-bottom: 4px;
}
.profile-field-value {
  font-family: 'Lora', Georgia, serif;
  font-size: 1rem;
  color: rgba(240, 223, 196, 0.92);
}
.address-link {
  color: rgba(200, 134, 10, 0.85);
  text-decoration: underline;
  transition: color 0.2s ease;
}
.address-link:hover {
  color: #c8860a;
  text-decoration: underline;
}
</style>
