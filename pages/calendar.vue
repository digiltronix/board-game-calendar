<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="6">
      <v-card>
        <v-card-title class="d-flex align-center pa-6">
          <v-icon color="primary" class="mr-3">mdi-calendar</v-icon>
          <h1 class="page-title">Calendar</h1>
          <v-spacer />
          <v-btn
            variant="elevated"
            color="primary"
            size="small"
            :to="routes.newGathering"
          >
            <v-icon start>mdi-calendar-plus</v-icon>New
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text v-if="loading" class="pa-8">
          <v-progress-linear
            indeterminate
            color="primary"
            aria-label="Loading gatherings"
          />
        </v-card-text>
        <v-card-text
          v-else-if="!hosting.length && !invited.length && !past.length"
          class="pa-6"
        >
          <div class="empty-state">
            <v-icon size="64" color="primary" class="mb-4" style="opacity: 0.3"
              >mdi-calendar-blank-outline</v-icon
            >
            <div class="empty-title">No gatherings yet</div>
            <div class="empty-desc">
              Host a game night or get invited to one, and it will show up here.
            </div>
            <v-btn
              variant="elevated"
              color="primary"
              class="mt-4"
              :to="routes.newGathering"
            >
              <v-icon start>mdi-calendar-plus</v-icon>New gathering
            </v-btn>
          </div>
        </v-card-text>
        <v-card-text v-else class="pa-6">
          <template v-if="hosting.length">
            <div class="section-label mb-3">Hosting</div>
            <div
              v-for="gathering in hosting"
              :key="gathering.id"
              class="event-item pa-5 mb-4"
            >
              <div class="d-flex align-center flex-wrap gap-3 mb-3">
                <v-chip
                  :color="stateColor(gathering.state)"
                  size="small"
                  variant="tonal"
                  class="text-capitalize"
                  >{{ gathering.state }}</v-chip
                >
                <span class="event-line"
                  ><v-icon size="16" class="mr-1">mdi-clock-outline</v-icon
                  >{{ formatDatetime(gathering.datetime) }}</span
                >
              </div>
              <div v-if="gathering.location" class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-map-marker-outline</v-icon
                >{{ gathering.location }}
              </div>
              <div v-if="gathering.notes" class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-note-text-outline</v-icon
                >{{ gathering.notes }}
              </div>
              <div v-if="gathering.games?.length" class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-rhombus-split</v-icon>
                <v-chip
                  v-for="game in gathering.games"
                  :key="game.id"
                  size="x-small"
                  variant="outlined"
                  class="mr-1"
                  >{{ game.name }}</v-chip
                >
              </div>
              <div
                v-if="guestEntries(gathering).length"
                class="event-line mb-3"
              >
                <v-icon size="16" class="mr-1">mdi-account-group</v-icon>
                <v-chip
                  v-for="guest in guestEntries(gathering)"
                  :key="guest.uid"
                  size="x-small"
                  :color="responseColor(guest.response)"
                  variant="tonal"
                  class="mr-1"
                >
                  <v-icon start size="12">{{
                    responseIcon(guest.response)
                  }}</v-icon
                  >{{ names[guest.uid] ?? '…' }}
                </v-chip>
              </div>
              <div v-else class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-account-group</v-icon>No
                guests invited yet
              </div>
              <div class="event-actions">
                <v-btn
                  v-if="gathering.state === 'pending'"
                  density="compact"
                  size="small"
                  variant="text"
                  color="success"
                  @click.stop="setState(gathering, 'confirmed')"
                >
                  <v-icon start>mdi-check-circle</v-icon>Confirm
                </v-btn>
                <v-menu v-if="gathering.state !== 'canceled'">
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      density="compact"
                      size="small"
                      variant="text"
                      color="accent"
                    >
                      <v-icon start>mdi-calendar-export</v-icon>Add to calendar
                    </v-btn>
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-google"
                      title="Google Calendar"
                      @click="addToGoogle(gathering)"
                    />
                    <v-list-item
                      prepend-icon="mdi-calendar-arrow-right"
                      title="Apple / Outlook (.ics)"
                      @click="addToApple(gathering)"
                    />
                  </v-list>
                </v-menu>
                <v-btn
                  v-if="gathering.state !== 'canceled'"
                  density="compact"
                  size="small"
                  variant="text"
                  color="accent"
                  @click.stop="editGathering(gathering)"
                >
                  <v-icon start>mdi-pencil</v-icon>Edit
                </v-btn>
                <v-btn
                  v-if="gathering.state !== 'canceled'"
                  density="compact"
                  size="small"
                  variant="text"
                  color="error"
                  @click.stop="setState(gathering, 'canceled')"
                >
                  <v-icon start>mdi-cancel</v-icon>Cancel
                </v-btn>
                <v-btn
                  v-else
                  density="compact"
                  size="small"
                  variant="text"
                  color="error"
                  @click.stop="deleteGathering(gathering)"
                >
                  <v-icon start>mdi-delete</v-icon>Delete
                </v-btn>
              </div>
            </div>
          </template>

          <template v-if="invited.length">
            <div class="section-label mb-3" :class="{ 'mt-4': hosting.length }">
              Invited
            </div>
            <div
              v-for="gathering in invited"
              :key="gathering.id"
              class="event-item pa-5 mb-4"
            >
              <div class="d-flex align-center flex-wrap gap-3 mb-3">
                <v-chip
                  :color="stateColor(gathering.state)"
                  size="small"
                  variant="tonal"
                  class="text-capitalize"
                  >{{ gathering.state }}</v-chip
                >
                <span class="event-line"
                  ><v-icon size="16" class="mr-1">mdi-clock-outline</v-icon
                  >{{ formatDatetime(gathering.datetime) }}</span
                >
              </div>
              <div class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-account</v-icon>Hosted by
                {{ names[gathering.host] ?? '…' }}
              </div>
              <div v-if="gathering.location" class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-map-marker-outline</v-icon
                >{{ gathering.location }}
              </div>
              <div v-if="gathering.notes" class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-note-text-outline</v-icon
                >{{ gathering.notes }}
              </div>
              <div v-if="gathering.games?.length" class="event-line mb-3">
                <v-icon size="16" class="mr-1">mdi-rhombus-split</v-icon>
                <v-chip
                  v-for="game in gathering.games"
                  :key="game.id"
                  size="x-small"
                  variant="outlined"
                  class="mr-1"
                  >{{ game.name }}</v-chip
                >
              </div>
              <div v-if="gathering.state !== 'canceled'" class="event-actions">
                <v-btn
                  density="compact"
                  size="small"
                  :variant="
                    myResponse(gathering) === 'accepted' ? 'tonal' : 'text'
                  "
                  color="success"
                  @click.stop="respond(gathering, 'accepted')"
                >
                  <v-icon start>mdi-check-circle</v-icon>Accept
                </v-btn>
                <v-btn
                  density="compact"
                  size="small"
                  :variant="
                    myResponse(gathering) === 'declined' ? 'tonal' : 'text'
                  "
                  color="error"
                  @click.stop="respond(gathering, 'declined')"
                >
                  <v-icon start>mdi-close-circle</v-icon>Decline
                </v-btn>
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      density="compact"
                      size="small"
                      variant="text"
                      color="accent"
                    >
                      <v-icon start>mdi-calendar-export</v-icon>Add to calendar
                    </v-btn>
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-google"
                      title="Google Calendar"
                      @click="addToGoogle(gathering)"
                    />
                    <v-list-item
                      prepend-icon="mdi-calendar-arrow-right"
                      title="Apple / Outlook (.ics)"
                      @click="addToApple(gathering)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </div>
          </template>

          <div
            v-if="!hosting.length && !invited.length"
            class="empty-desc text-center py-4"
          >
            No upcoming gatherings — host one or get invited.
          </div>

          <template v-if="past.length">
            <v-divider class="my-4" />
            <v-btn
              variant="text"
              color="accent"
              size="small"
              :aria-expanded="showPast ? 'true' : 'false'"
              @click="showPast = !showPast"
            >
              <v-icon start>{{
                showPast ? 'mdi-chevron-up' : 'mdi-chevron-down'
              }}</v-icon>
              Past gatherings ({{ past.length }})
            </v-btn>
            <template v-if="showPast">
              <div
                v-for="gathering in past"
                :key="gathering.id"
                class="event-item event-item--past pa-5 mb-4 mt-3"
              >
                <div class="d-flex align-center flex-wrap gap-3 mb-3">
                  <v-chip
                    :color="stateColor(gathering.state)"
                    size="small"
                    variant="tonal"
                    class="text-capitalize"
                    >{{ gathering.state }}</v-chip
                  >
                  <span class="event-line"
                    ><v-icon size="16" class="mr-1">mdi-clock-outline</v-icon
                    >{{ formatDatetime(gathering.datetime) }}</span
                  >
                </div>
                <div v-if="gathering.host !== uid" class="event-line mb-3">
                  <v-icon size="16" class="mr-1">mdi-account</v-icon>Hosted by
                  {{ names[gathering.host] ?? '…' }}
                </div>
                <div v-if="gathering.games?.length" class="event-line mb-3">
                  <v-icon size="16" class="mr-1">mdi-rhombus-split</v-icon>
                  <v-chip
                    v-for="game in gathering.games"
                    :key="game.id"
                    size="x-small"
                    variant="outlined"
                    class="mr-1"
                    >{{ game.name }}</v-chip
                  >
                </div>
                <div class="event-actions">
                  <v-btn
                    v-if="gathering.host === uid"
                    density="compact"
                    size="small"
                    variant="text"
                    color="error"
                    @click.stop="deleteGathering(gathering)"
                  >
                    <v-icon start>mdi-delete</v-icon>Delete
                  </v-btn>
                  <v-btn
                    v-else
                    density="compact"
                    size="small"
                    variant="text"
                    color="error"
                    @click.stop="removeFromMyCalendar(gathering)"
                  >
                    <v-icon start>mdi-delete</v-icon>Remove
                  </v-btn>
                </div>
              </div>
            </template>
          </template>
        </v-card-text>
      </v-card>
      <Snackbar ref="snackbar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ref as dbRef, onValue, update, set, remove } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import Snackbar from '~/components/Snackbar.vue'
import helpers from '~/helpers/helpers'
import routes from '~/helpers/routes'
import constants from '~/helpers/constants'
import {
  splitGatherings,
  stateColor,
  responseColor,
  responseIcon,
  formatDatetime,
  type GatheringWithId,
} from '~/helpers/gatherings'
import {
  googleCalendarUrl,
  downloadIcs,
  toCalendarEventInput,
} from '~/helpers/calendar'
import type { Gathering, GatheringState, GuestResponse } from '~/helpers/types'

useHead({ title: 'Calendar' })

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const nuxtApp = useNuxtApp()
const db = nuxtApp.$db
const logEvent = nuxtApp.$logEvent
const functions = nuxtApp.$functions

const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)
// gatherings are readable only by their participants, so the calendar follows
// the user's own userGatherings/{uid} index and listens to each entry
const gatheringsById = ref<Record<string, Gathering>>({})
const loading = ref(true)
let unsubscribeIndex: (() => void) | null = null
const gatheringListeners = new Map<string, () => void>()

const uid = userStore.user!.uid
const { names, resolveNames, guestEntries } = useGatheringDisplay()

// Email "Accept"/"Decline" buttons deep-link here as
// /calendar?id={gatheringId}&respond=accepted|declined. The RSVP is applied
// once the gathering loads and we confirm the user is one of its invited guests.
const pendingRsvp = ref<{ id: string; response: GuestResponse } | null>(null)

function appUrl(): string {
  return window.location.origin
}

function calendarInput(gathering: GatheringWithId) {
  return toCalendarEventInput(gathering, names.value[gathering.host])
}

function addToGoogle(gathering: GatheringWithId) {
  window.open(
    googleCalendarUrl(calendarInput(gathering), appUrl()),
    '_blank',
    'noopener'
  )
  logEvent('gathering_add_to_calendar', { provider: 'google' })
}

function addToApple(gathering: GatheringWithId) {
  downloadIcs(calendarInput(gathering), appUrl())
  logEvent('gathering_add_to_calendar', { provider: 'ics' })
}

function clearRsvpQuery() {
  if (route.query.respond || route.query.id) {
    void router.replace({ path: routes.calendar })
  }
}

function dropGathering(id: string) {
  const { [id]: _gone, ...rest } = gatheringsById.value
  gatheringsById.value = rest
}

function watchGathering(id: string) {
  const unsubscribe = onValue(
    dbRef(db, `gatherings/${id}`),
    (snapshot) => {
      const val = snapshot.val() as Gathering | null
      if (val) gatheringsById.value = { ...gatheringsById.value, [id]: val }
      else dropGathering(id)
    },
    () => {
      // unreadable: deleted or uninvited with the pointer left behind —
      // drop it and clean up our own dangling index entry
      dropGathering(id)
      gatheringListeners.get(id)?.()
      gatheringListeners.delete(id)
      void remove(dbRef(db, `userGatherings/${uid}/${id}`)).catch(() => {})
    }
  )
  gatheringListeners.set(id, unsubscribe)
}

onMounted(() => {
  const respondParam = route.query.respond
  const idParam = route.query.id
  if (
    (respondParam === 'accepted' || respondParam === 'declined') &&
    typeof idParam === 'string'
  ) {
    pendingRsvp.value = { id: idParam, response: respondParam }
  }
  unsubscribeIndex = onValue(
    dbRef(db, `userGatherings/${uid}`),
    (snapshot) => {
      loading.value = false
      const ids = new Set(Object.keys(snapshot.val() ?? {}))
      for (const id of ids) if (!gatheringListeners.has(id)) watchGathering(id)
      for (const [id, unsubscribe] of gatheringListeners) {
        if (!ids.has(id)) {
          unsubscribe()
          gatheringListeners.delete(id)
          dropGathering(id)
        }
      }
    },
    (err) => {
      loading.value = false
      snackbar.value?.showSnackbarWithMessage(
        helpers.handleError(err).message,
        true
      )
    }
  )
  setTimeout(() => {
    loading.value = false
  }, constants.LoadingTimeoutInMs)
})

onUnmounted(() => {
  unsubscribeIndex?.()
  for (const unsubscribe of gatheringListeners.values()) unsubscribe()
  gatheringListeners.clear()
})

const gatherings = computed<GatheringWithId[]>(() =>
  Object.entries(gatheringsById.value).map(([id, gathering]) => ({
    id,
    ...gathering,
  }))
)
// The past/upcoming cutoff is fixed at page load; fine for a page visit.
const loadedAt = new Date()
const sections = computed(() =>
  splitGatherings(gatherings.value, uid, loadedAt)
)
const hosting = computed(() => sections.value.hosting)
const invited = computed(() => sections.value.invited)
const past = computed(() => sections.value.past)
const showPast = ref(false)

watch(sections, (value) => {
  void resolveNames(value)
})

// When a user follows an email invite link but isn't yet a registered guest,
// call the acceptEmailInvite Cloud Function to convert their email invite into
// a proper guest entry. The userGatherings index update inside the function
// then triggers the index listener, which calls watchGathering — after which
// the RSVP watcher below processes the response normally.
async function tryAcceptEmailInvite() {
  const intent = pendingRsvp.value
  if (!intent || gatheringsById.value[intent.id]) return
  try {
    const fn = httpsCallable<
      { gatheringId: string; response: string },
      { success: boolean }
    >(functions, 'acceptEmailInvite')
    await fn({ gatheringId: intent.id, response: intent.response })
  } catch (err) {
    pendingRsvp.value = null
    clearRsvpQuery()
    const code = (err as { code?: string })?.code
    const msg =
      code === 'functions/not-found'
        ? 'No invitation found for your account.'
        : code === 'functions/failed-precondition'
          ? 'This gathering has been canceled.'
          : helpers.handleError(err).message
    snackbar.value?.showSnackbarWithMessage(msg, true)
  }
}

watch(loading, (isLoading) => {
  if (isLoading || !pendingRsvp.value) return
  void tryAcceptEmailInvite()
})

// Apply an email-deep-linked RSVP once its gathering has loaded. Fires when
// gatherings arrive (or when the intent is first set).
watch([gatheringsById, pendingRsvp], async () => {
  const intent = pendingRsvp.value
  if (!intent) return
  const gathering = gatheringsById.value[intent.id]
  if (!gathering) return // not loaded yet (or the user isn't a participant)
  // Only invited guests can RSVP; hosts and non-invitees are ignored.
  if (gathering.host === uid || !(uid in (gathering.guests ?? {}))) {
    pendingRsvp.value = null
    clearRsvpQuery()
    return
  }
  const { response } = intent
  pendingRsvp.value = null // clear before awaiting to avoid re-entry
  if (gathering.state === 'canceled') {
    snackbar.value?.showSnackbarWithMessage(
      'This gathering has been canceled.',
      true
    )
    clearRsvpQuery()
    return
  }
  await respond({ id: intent.id, ...gathering }, response)
  snackbar.value?.showSnackbarWithMessage(
    response === 'accepted'
      ? 'You accepted the invitation.'
      : 'You declined the invitation.',
    false
  )
  clearRsvpQuery()
})

function myResponse(gathering: Gathering): GuestResponse | undefined {
  return gathering.guests?.[uid]
}

async function setState(gathering: GatheringWithId, state: GatheringState) {
  try {
    await update(dbRef(db, `gatherings/${gathering.id}`), { state })
    logEvent('gathering_state_changed', { state })
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function respond(gathering: GatheringWithId, response: GuestResponse) {
  try {
    await set(dbRef(db, `gatherings/${gathering.id}/guests/${uid}`), response)
    logEvent('gathering_rsvp', { response })
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function deleteGathering(gathering: GatheringWithId) {
  try {
    // one atomic update: the rules check the pre-delete gathering, so the
    // index entries can be removed alongside it
    const updates: Record<string, null> = {
      [`gatherings/${gathering.id}`]: null,
      [`userGatherings/${uid}/${gathering.id}`]: null,
    }
    for (const guestUid of Object.keys(gathering.guests ?? {})) {
      updates[`userGatherings/${guestUid}/${gathering.id}`] = null
    }
    await update(dbRef(db), updates)
    logEvent('gathering_deleted')
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

function editGathering(gathering: GatheringWithId) {
  router.push({ path: routes.newGathering, query: { id: gathering.id } })
}

// Guests can always delete their own index entry (the same rule that backs
// dangling-pointer cleanup); the index listener then drops the gathering.
async function removeFromMyCalendar(gathering: GatheringWithId) {
  try {
    await remove(dbRef(db, `userGatherings/${uid}/${gathering.id}`))
    logEvent('gathering_removed_from_calendar')
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}
</script>

<style scoped>
.event-item {
  border-radius: 10px;
  background: rgba(200, 134, 10, 0.04);
  border: 1px solid rgba(200, 134, 10, 0.12);
  box-shadow: inset 0 1px 0 rgba(240, 223, 196, 0.04);
  transition: all 0.2s ease;
  animation: deal-in 0.35s ease both;
}
.event-item:hover {
  background: rgba(200, 134, 10, 0.08);
  border-color: rgba(200, 134, 10, 0.22);
  transform: translateY(-2px);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.35),
    0 1px 4px rgba(200, 134, 10, 0.1);
}
/* Past gatherings are history: keep them readable but visually receded */
.event-item--past {
  opacity: 0.75;
}
.event-item--past:hover {
  transform: none;
}
.event-line {
  font-size: 0.98rem;
  line-height: 1.5;
  color: rgba(240, 223, 196, 0.85);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
/* Slightly larger, more legible chips inside the event cards */
.event-item :deep(.v-chip) {
  font-size: 0.8rem !important;
}
/* A touch more room around the action buttons */
.event-item .event-actions {
  gap: 6px;
  margin-top: 12px;
}
</style>
