<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="6">
      <v-card>
        <v-card-title class="d-flex align-center pa-6">
          <v-icon color="primary" class="mr-3">$accountGroup</v-icon>
          <h1 class="page-title">Friends</h1>
          <v-spacer />
          <v-btn
            variant="elevated"
            color="primary"
            size="small"
            @click.stop="toggleAddArea"
          >
            <v-icon start>{{
              friendsAreaOpen ? '$plusCircle' : '$arrowLeftCircle'
            }}</v-icon>
            {{ friendsAreaOpen ? 'Add' : 'Back' }}
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text v-if="loading" class="pa-8">
          <v-progress-linear
            indeterminate
            color="primary"
            aria-label="Loading friends"
          />
        </v-card-text>
        <v-card-text v-else-if="friendsAreaOpen" class="pa-6">
          <template v-if="incomingRequests.length">
            <div class="section-label mb-2">Friend requests</div>
            <v-list class="mb-4">
              <v-list-item
                v-for="request in incomingRequests"
                :key="request.userId"
                class="friend-item mb-1"
              >
                <template #prepend>
                  <v-avatar
                    color="accent"
                    size="36"
                    class="mr-3"
                    aria-hidden="true"
                  >
                    <span class="avatar-initial">{{
                      request.name?.charAt(0)?.toUpperCase() || '?'
                    }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ request.name }}</v-list-item-title>
                <v-list-item-subtitle>{{
                  request.queryableEmail
                }}</v-list-item-subtitle>
                <div class="event-actions">
                  <v-btn
                    density="compact"
                    size="small"
                    variant="text"
                    color="success"
                    @click.stop="handleAccept(request.userId)"
                  >
                    <v-icon start>$checkCircle</v-icon>Accept
                  </v-btn>
                  <v-btn
                    density="compact"
                    size="small"
                    variant="text"
                    color="error"
                    @click.stop="handleDecline(request.userId)"
                  >
                    <v-icon start>$closeCircle</v-icon>Decline
                  </v-btn>
                </div>
              </v-list-item>
            </v-list>
            <v-divider class="mb-4" />
          </template>
          <div
            v-if="!friends.length && !incomingRequests.length"
            class="empty-state"
          >
            <v-icon size="64" color="primary" class="mb-4" style="opacity: 0.3"
              >$accountMultiplePlusOutline</v-icon
            >
            <div class="empty-title">No friends yet</div>
            <div class="empty-desc">
              Search for other players and add them to your list.
            </div>
            <v-btn
              variant="elevated"
              color="primary"
              class="mt-4"
              @click.stop="toggleAddArea"
            >
              <v-icon start>$plusCircle</v-icon>Find friends
            </v-btn>
          </div>
          <template v-else-if="friends.length">
            <div v-if="incomingRequests.length" class="section-label mb-2">
              Friends
            </div>
            <v-list>
              <v-list-item
                v-for="(friend, id) in friends"
                :key="id"
                class="friend-item mb-1"
              >
                <template #prepend>
                  <v-avatar
                    color="primary"
                    size="36"
                    class="mr-3"
                    aria-hidden="true"
                  >
                    <span class="avatar-initial">{{
                      friend.name?.charAt(0)?.toUpperCase() || '?'
                    }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ friend.name }}</v-list-item-title>
                <div class="event-actions">
                  <v-btn
                    density="compact"
                    size="small"
                    variant="text"
                    color="accent"
                    :to="`${routes.gameCollection}?uid=${friend.userId}`"
                  >
                    <v-icon start>$cardsOutline</v-icon>Collection
                  </v-btn>
                  <v-btn
                    density="compact"
                    size="small"
                    variant="text"
                    color="error"
                    @click.stop="handleRemove(friend.userId)"
                  >
                    <v-icon start>$minusCircle</v-icon>Remove
                  </v-btn>
                </div>
              </v-list-item>
            </v-list>
          </template>
        </v-card-text>
        <v-card-text v-else class="pa-6">
          <v-text-field
            v-model="searchQuery"
            label="Search for friends"
            placeholder="Search by name, email, or phone number"
            :hint="`Search by name, email, or phone number (min ${constants.MinSearchLength} chars)`"
            persistent-hint
            prepend-inner-icon="$magnify"
            :loading="isSearching"
            clearable
            class="mb-4"
          />
          <v-list>
            <v-list-item
              v-for="(person, id) in searchResults"
              :key="id"
              class="friend-item mb-1"
            >
              <template #prepend>
                <v-avatar
                  color="surface-variant"
                  size="36"
                  class="mr-3"
                  aria-hidden="true"
                >
                  <span class="avatar-initial avatar-initial--on-dark">{{
                    person.name?.charAt(0)?.toUpperCase() || '?'
                  }}</span>
                </v-avatar>
              </template>
              <v-list-item-title>{{ person.name }}</v-list-item-title>
              <v-list-item-subtitle>{{
                person.queryableEmail
              }}</v-list-item-subtitle>
              <div class="event-actions">
                <v-chip
                  v-if="person.isFriend"
                  size="small"
                  color="success"
                  variant="tonal"
                >
                  <v-icon start>$checkCircle</v-icon>Friends
                </v-chip>
                <v-chip
                  v-else-if="person.requestSent"
                  size="small"
                  color="primary"
                  variant="tonal"
                >
                  <v-icon start>$clockOutline</v-icon>Request sent
                </v-chip>
                <v-btn
                  v-else
                  size="small"
                  variant="elevated"
                  color="accent"
                  @click.stop="handleSendRequest(id, person)"
                >
                  <v-icon start>$plusCircle</v-icon>Add
                </v-btn>
              </div>
            </v-list-item>
          </v-list>
          <div
            v-if="
              searchQuery?.length >= constants.MinSearchLength &&
              Object.keys(searchResults).length <= 0
            "
            class="empty-desc text-center mt-4"
          >
            No matching person found
          </div>
        </v-card-text>
      </v-card>
      <Snackbar ref="snackbar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ref as dbRef, onValue, get } from 'firebase/database'
import Snackbar from '~/components/Snackbar.vue'
import helpers from '~/helpers/helpers'
import constants from '~/helpers/constants'
import routes from '~/helpers/routes'
import type { Friend, Person } from '~/helpers/types'

useHead({ title: 'Friends' })

const userStore = useUserStore()
const nuxtApp = useNuxtApp()
const db = nuxtApp.$db
const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)
const friendsAreaOpen = ref(true)
const friends = ref<Friend[]>([])
const incomingRequests = ref<Friend[]>([])
const loading = ref(true)
let unsubscribe: (() => void) | null = null
let unsubscribeRequests: (() => void) | null = null

function showError(err: unknown) {
  snackbar.value?.showSnackbarWithMessage(
    helpers.handleError(err).message,
    true
  )
}

const { searchQuery, searchResults, isSearching } = useFriendSearch(
  friends,
  showError
)
const { sendFriendRequest, acceptRequest, declineRequest, removeFriend } =
  useFriendActions()

function fetchProfiles(ids: Record<string, unknown>): Promise<Friend[]> {
  const userPromises = Object.keys(ids).map((userId) =>
    get(dbRef(db, `profiles/${userId}`)).then((snap) => ({
      userId,
      ...snap.val(),
    }))
  )
  return Promise.all(userPromises)
}

onMounted(() => {
  const ownUid = userStore.user!.uid
  const friendsRef = dbRef(db, `users/${ownUid}/friends`)
  unsubscribe = onValue(
    friendsRef,
    async (snapshot) => {
      const ids = snapshot.val()
      loading.value = false
      friends.value = ids ? await fetchProfiles(ids) : []
    },
    (err) => {
      loading.value = false
      showError(err)
    }
  )
  const requestsRef = dbRef(db, `friendRequests/${ownUid}`)
  unsubscribeRequests = onValue(
    requestsRef,
    async (snapshot) => {
      const ids = snapshot.val()
      incomingRequests.value = ids ? await fetchProfiles(ids) : []
    },
    showError
  )
  setTimeout(() => {
    loading.value = false
  }, constants.LoadingTimeoutInMs)
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeRequests?.()
})
function toggleAddArea() {
  friendsAreaOpen.value = !friendsAreaOpen.value
}

async function handleSendRequest(id: string, person: Person) {
  try {
    await sendFriendRequest(id)
    person.requestSent = true
    snackbar.value?.showSnackbarWithMessage('Friend request sent', false)
  } catch (err) {
    // blocked lists are private, so a block surfaces as a permission error
    if (String(err).includes('PERMISSION_DENIED')) {
      snackbar.value?.showSnackbarWithMessage(
        'This user has declined your request',
        true
      )
      return
    }
    showError(err)
  }
}

async function handleAccept(fromUid: string) {
  try {
    await acceptRequest(fromUid)
  } catch (err) {
    showError(err)
  }
}

async function handleDecline(fromUid: string) {
  try {
    await declineRequest(fromUid)
  } catch (err) {
    showError(err)
  }
}

async function handleRemove(friendId: string) {
  try {
    await removeFriend(friendId)
  } catch (err) {
    showError(err)
  }
}
</script>

<style scoped>
.friend-item {
  border-radius: 10px;
  transition: background 0.2s ease;
}
.friend-item:hover {
  background: rgba(200, 134, 10, 0.07);
}
/* Dark initial on the brass/sand token avatars (primary/accent bg) — ~5.8:1 */
.avatar-initial {
  font-weight: 700;
  font-size: 1rem;
  color: #231708;
}
/* Light initial when the avatar sits on a dark surface-variant bg */
.avatar-initial--on-dark {
  color: #e8d4a8;
}
.friend-item :deep(.v-list-item-title) {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}
</style>
