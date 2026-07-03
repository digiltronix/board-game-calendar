<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="6">
      <v-card>
        <v-card-title class="d-flex align-center pa-6">
          <v-icon color="primary" class="mr-3">{{
            editId ? 'mdi-calendar-edit' : 'mdi-calendar-plus'
          }}</v-icon>
          <h1 class="page-title">
            {{ editId ? 'Edit gathering' : 'New gathering' }}
          </h1>
        </v-card-title>
        <v-divider />
        <v-card-text v-if="loading" class="pa-8">
          <v-progress-linear
            indeterminate
            color="primary"
            aria-label="Loading gathering"
          />
        </v-card-text>
        <v-card-text v-else class="pa-6">
          <v-form ref="gatheringForm" @submit.prevent="createGathering">
            <div class="section-label mb-2">When</div>
            <v-row dense class="mb-2">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="date"
                  type="date"
                  label="Date"
                  :rules="[validation.isRequired]"
                  prepend-inner-icon="mdi-calendar"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="time"
                  type="time"
                  label="Start time"
                  :rules="[validation.isRequired]"
                  prepend-inner-icon="mdi-clock-outline"
                />
              </v-col>
            </v-row>
            <div class="section-label mb-2">Details</div>
            <v-text-field
              v-model="maxGuests"
              type="number"
              label="Max guests"
              :rules="[validation.isMaxGuests]"
              prepend-inner-icon="mdi-account-multiple-outline"
              class="mb-2"
            />
            <div class="section-label mb-2">Guests</div>
            <v-select
              v-model="selectedGuests"
              :items="friendItems"
              multiple
              chips
              closable-chips
              label="Invite friends"
              prepend-inner-icon="mdi-account-group"
              :hint="
                friendItems.length
                  ? ''
                  : 'Add friends on the Friends page to invite them'
              "
              persistent-hint
              class="mb-2"
            />
            <div class="section-label mb-2 mt-4">Email invites</div>
            <div class="d-flex align-start gap-2 mb-2">
              <v-text-field
                v-model="emailInput"
                type="email"
                label="Invite by email address"
                prepend-inner-icon="mdi-email-outline"
                hint="Invite someone who doesn't have an account yet"
                persistent-hint
                @keydown.enter.prevent="addEmailInvite"
              />
              <v-btn
                color="primary"
                variant="tonal"
                height="56"
                :disabled="!emailInput.trim()"
                class="flex-shrink-0"
                @click="addEmailInvite"
              >
                Add
              </v-btn>
            </div>
            <div
              v-if="emailInviteList.length"
              class="d-flex flex-wrap gap-2 mb-4"
            >
              <v-chip
                v-for="email in emailInviteList"
                :key="email"
                closable
                prepend-icon="mdi-email-outline"
                @click:close="removeEmailInvite(email)"
              >
                {{ email }}
              </v-chip>
            </div>
            <div v-else class="mb-2" />
            <div class="section-label mb-2">Games</div>
            <v-select
              v-model="selectedGameIds"
              :items="gameItems"
              multiple
              chips
              closable-chips
              label="Games to play"
              prepend-inner-icon="mdi-rhombus-split"
              :hint="
                gameItems.length
                  ? ''
                  : 'Add games on the Game collection page to pick them'
              "
              persistent-hint
              class="mb-6"
            />
            <v-btn
              type="submit"
              block
              color="primary"
              size="large"
              :loading="saving"
            >
              <v-icon start>mdi-calendar-check</v-icon
              >{{ editId ? 'Save changes' : 'Create gathering' }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
      <Snackbar ref="snackbar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ref as dbRef, get, push, set, update, remove } from 'firebase/database'
import Snackbar from '~/components/Snackbar.vue'
import helpers from '~/helpers/helpers'
import routes from '~/helpers/routes'
import type {
  FormInstance,
  Game,
  Gathering,
  GatheringState,
  GuestResponse,
} from '~/helpers/types'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const nuxtApp = useNuxtApp()
const db = nuxtApp.$db
const logEvent = nuxtApp.$logEvent

const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)
const gatheringForm = ref<FormInstance | null>(null)
const loading = ref(true)
const saving = ref(false)

const date = ref('')
const time = ref('')
const maxGuests = ref<number | string>(0)
const selectedGuests = ref<string[]>([])
const selectedGameIds = ref<string[]>([])
const friendItems = ref<{ title: string; value: string }[]>([])
const gameItems = ref<{ title: string; value: string }[]>([])
let gamesById: Record<string, Game> = {}

// Email invite state (non-user invitees)
const emailInput = ref('')
const emailInviteList = ref<string[]>([])
let existingEmailInvitesByKey: Record<string, string> = {}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Returns false only when the field holds an invalid address (an empty field
// and a duplicate are both fine). Also called on submit, so an address typed
// into the field but never "Add"ed isn't silently dropped from the gathering.
function addEmailInvite(): boolean {
  const email = emailInput.value.trim().toLowerCase()
  if (!email) return true
  if (!isValidEmail(email)) {
    snackbar.value?.showSnackbarWithMessage(
      'Please enter a valid email address.',
      true
    )
    return false
  }
  if (!emailInviteList.value.includes(email)) {
    emailInviteList.value.push(email)
  }
  emailInput.value = ''
  return true
}

function removeEmailInvite(email: string) {
  emailInviteList.value = emailInviteList.value.filter((e) => e !== email)
}

// Edit mode: /gatherings/new?id={gatheringId} prefills and updates in place
const editId = typeof route.query.id === 'string' ? route.query.id : null
let existingState: GatheringState = 'pending'
let existingGuests: Record<string, GuestResponse> = {}
// initiator is pinned by the security rules: auth.uid at creation, immutable after
let existingInitiator = ''

useHead({ title: editId ? 'Edit gathering' : 'New gathering' })

const validation = {
  isRequired: (v: string) => !!v || 'Required',
  isMaxGuests: (v: number | string) =>
    v == null ||
    v === '' ||
    (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000) ||
    'Must be a whole number between 0 and 1000',
}

onMounted(async () => {
  const uid = userStore.user!.uid
  try {
    const [profileSnap, friendsSnap, collectionSnap] = await Promise.all([
      get(dbRef(db, `users/${uid}/maxPeople`)),
      get(dbRef(db, `users/${uid}/friends`)),
      get(dbRef(db, `users/${uid}/collection`)),
    ])

    // Hosts usually count themselves in maxPeople, hence the -1 default
    const maxPeople = profileSnap.val()
    if (typeof maxPeople === 'number' && maxPeople > 0)
      maxGuests.value = maxPeople - 1

    const friendIds: Record<string, true> | null = friendsSnap.val()
    if (friendIds) {
      const friendEntries = await Promise.all(
        Object.keys(friendIds).map(async (friendId) => {
          const nameSnap = await get(dbRef(db, `profiles/${friendId}/name`))
          return { title: nameSnap.val() ?? 'Unknown player', value: friendId }
        })
      )
      friendItems.value = friendEntries.sort((a, b) =>
        a.title.localeCompare(b.title)
      )
    }

    const collection: Record<string, Game> | null = collectionSnap.val()
    if (collection) {
      gamesById = Object.fromEntries(
        Object.values(collection).map((game) => [game.id, game])
      )
      gameItems.value = Object.values(collection)
        .map((game) => ({ title: game.name, value: game.id }))
        .sort((a, b) => a.title.localeCompare(b.title))
    }

    if (editId) {
      // non-participants get a permission error rather than a null read
      const gathering: Gathering | null = await get(
        dbRef(db, `gatherings/${editId}`)
      )
        .then((snap) => snap.val())
        .catch(() => null)
      if (!gathering || gathering.host !== uid) {
        snackbar.value?.showSnackbarWithMessage('Gathering not found.', true)
        await router.replace(routes.calendar)
        return
      }
      existingState = gathering.state
      existingGuests = gathering.guests ?? {}
      existingInitiator = gathering.initiator
      existingEmailInvitesByKey = gathering.emailInvites ?? {}
      emailInviteList.value = Object.values(existingEmailInvitesByKey).map(
        (e) => e.toLowerCase()
      )
      const dt = new Date(gathering.datetime)
      const pad = (n: number) => String(n).padStart(2, '0')
      date.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
      time.value = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
      maxGuests.value = gathering.maxGuests
      selectedGuests.value = Object.keys(existingGuests)
      selectedGameIds.value = (gathering.games ?? []).map((game) => game.id)
      // Keep invited guests visible even if they are no longer friends
      for (const guestId of selectedGuests.value) {
        if (!friendItems.value.some((friend) => friend.value === guestId)) {
          const nameSnap = await get(dbRef(db, `profiles/${guestId}/name`))
          friendItems.value.push({
            title: nameSnap.val() ?? 'Unknown player',
            value: guestId,
          })
        }
      }
      // Keep selections visible even if a game has since left the collection
      for (const game of gathering.games ?? []) {
        if (!gamesById[game.id]) {
          gamesById[game.id] = game
          gameItems.value.push({ title: game.name, value: game.id })
        }
      }
    }
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  } finally {
    loading.value = false
  }
})

async function createGathering() {
  // Flush a typed-but-not-added email invite into the list; abort the save if
  // it's invalid so the error isn't lost behind a successful-looking save.
  if (!addEmailInvite()) return
  const result = await gatheringForm.value?.validate()
  if (!result?.valid) return
  const datetime = new Date(`${date.value}T${time.value}`)
  if (Number.isNaN(datetime.getTime())) {
    snackbar.value?.showSnackbarWithMessage(
      'Please enter a valid date and time.',
      true
    )
    return
  }
  if (datetime.getTime() < Date.now()) {
    snackbar.value?.showSnackbarWithMessage(
      'The gathering must be in the future.',
      true
    )
    return
  }
  saving.value = true
  try {
    const uid = userStore.user!.uid
    const gathering: Gathering = {
      state: editId ? existingState : 'pending',
      datetime: datetime.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      initiator: editId ? existingInitiator : uid,
      host: uid,
      maxGuests: Number(maxGuests.value || 0),
      // existing guests keep their response when editing; new ones start as invited
      guests: Object.fromEntries(
        selectedGuests.value.map((guestId) => [
          guestId,
          existingGuests[guestId] ?? ('invited' as GuestResponse),
        ])
      ),
      games: selectedGameIds.value.map((id) => ({
        id,
        name: gamesById[id]?.name ?? 'Unknown game',
      })),
    }
    // The userGatherings index drives each participant's calendar. It can't
    // be written in the same atomic update as the gathering — the rules
    // validate index entries against the gathering as it exists *before* the
    // write — so the gathering is written first, then the index.
    let gatheringId = editId
    if (editId) {
      await update(dbRef(db, `gatherings/${editId}`), gathering)
    } else {
      const gatheringRef = push(dbRef(db, 'gatherings'))
      await set(gatheringRef, gathering)
      gatheringId = gatheringRef.key
    }
    const indexUpdates: Record<string, true | null> = {
      [`userGatherings/${uid}/${gatheringId}`]: true,
    }
    for (const guestId of selectedGuests.value) {
      indexUpdates[`userGatherings/${guestId}/${gatheringId}`] = true
    }
    for (const guestId of Object.keys(existingGuests)) {
      if (!selectedGuests.value.includes(guestId)) {
        indexUpdates[`userGatherings/${guestId}/${gatheringId}`] = null
      }
    }
    await update(dbRef(db), indexUpdates)

    // Sync email invites: delete removed ones, push new ones
    // (onEmailInviteAdded Cloud Function fires only for genuinely new entries)
    const originalEmails = new Set(
      Object.values(existingEmailInvitesByKey).map((e) => e.toLowerCase())
    )
    const currentEmails = new Set(emailInviteList.value)
    const emailDeleteOps = Object.entries(existingEmailInvitesByKey)
      .filter(([, email]) => !currentEmails.has(email.toLowerCase()))
      .map(([key]) =>
        remove(dbRef(db, `gatherings/${gatheringId}/emailInvites/${key}`))
      )
    const emailAddOps = emailInviteList.value
      .filter((email) => !originalEmails.has(email))
      .map((email) =>
        set(push(dbRef(db, `gatherings/${gatheringId}/emailInvites`)), email)
      )
    await Promise.all([...emailDeleteOps, ...emailAddOps])

    logEvent(editId ? 'edit_gathering' : 'create_gathering', {
      guests: selectedGuests.value.length,
      games: selectedGameIds.value.length,
      emailInvites: emailInviteList.value.length,
    })
    await router.push(routes.calendar)
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* Blend browser-native date/time controls with the warm Vuetify styling */
:deep(input[type='date']),
:deep(input[type='time']) {
  color-scheme: dark;
  color: rgba(240, 223, 196, 0.92);
}

:deep(input[type='date']::-webkit-calendar-picker-indicator),
:deep(input[type='time']::-webkit-calendar-picker-indicator) {
  filter: invert(70%) sepia(60%) saturate(400%) hue-rotate(10deg)
    brightness(90%);
  cursor: pointer;
  opacity: 0.7;
}
</style>
