<template>
  <v-row justify="center">
    <v-col cols="12" sm="11" md="9" lg="7">
      <v-card>
        <v-card-title class="page-card-title">
          <div class="d-flex align-center">
            <v-icon color="primary" class="mr-3 flex-shrink-0"
              >$rhombusSplit</v-icon
            >
            <h1 class="page-title">{{ pageTitle }}</h1>
          </div>
          <div class="page-header-actions">
            <template v-if="isFriendView">
              <v-btn
                :to="routes.friends"
                variant="elevated"
                color="primary"
                size="small"
              >
                <v-icon start>$arrowLeftCircle</v-icon>Back
              </v-btn>
            </template>
            <template v-else-if="activeArea === 'collection'">
              <v-btn
                variant="elevated"
                color="primary"
                size="small"
                @click.stop="activeArea = 'addGame'"
              >
                <v-icon start>$plusCircle</v-icon>Add game
              </v-btn>
              <v-btn
                variant="elevated"
                color="warning"
                size="small"
                @click.stop="openRateArea"
              >
                <v-icon start>$starOutline</v-icon>Rate
              </v-btn>
            </template>
            <v-btn
              v-else
              variant="elevated"
              color="primary"
              size="small"
              @click.stop="activeArea = 'collection'"
            >
              <v-icon start>$arrowLeftCircle</v-icon>Back
            </v-btn>
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <div v-if="loading">
            <v-progress-linear
              indeterminate
              color="primary"
              aria-label="Loading collection"
            />
          </div>

          <!-- Collection list (owner or friend) -->
          <div v-else-if="activeArea === 'collection'">
            <div v-if="!collection" class="empty-state">
              <v-icon
                size="64"
                color="primary"
                class="mb-4"
                style="opacity: 0.3"
                >$cardsOutline</v-icon
              >
              <div class="empty-title">No games yet</div>
              <div v-if="!isFriendView" class="empty-desc">
                Add games from BoardGameGeek to build your collection.
              </div>
              <div v-else class="empty-desc">
                This friend hasn't added any games yet.
              </div>
              <v-btn
                v-if="!isFriendView"
                variant="elevated"
                color="primary"
                class="mt-4"
                @click.stop="activeArea = 'addGame'"
              >
                <v-icon start>$plusCircle</v-icon>Add games
              </v-btn>
            </div>
            <div v-else>
              <div class="d-flex gap-3 mb-3 flex-wrap align-center">
                <v-text-field
                  v-model="filterGames"
                  label="Filter games"
                  prepend-inner-icon="$magnify"
                  clearable
                  hide-details
                  class="flex-grow-1"
                  style="min-width: 180px"
                />
                <v-select
                  v-model="sortBy"
                  :items="sortOptions"
                  label="Sort"
                  hide-details
                  style="max-width: 190px"
                />
              </div>

              <div v-if="availableGenres.length" class="mb-3">
                <v-chip-group
                  v-model="selectedGenres"
                  multiple
                  column
                  selected-class="text-primary"
                  class="genre-chip-group"
                >
                  <v-chip
                    v-for="genre in visibleGenres"
                    :key="genre"
                    :value="genre"
                    size="small"
                    filter
                    variant="outlined"
                    color="info"
                  >
                    {{ genre }}
                  </v-chip>
                </v-chip-group>
                <v-btn
                  v-if="availableGenres.length > GENRE_CHIP_LIMIT"
                  variant="text"
                  size="small"
                  color="accent"
                  @click="showAllGenres = !showAllGenres"
                >
                  {{
                    showAllGenres
                      ? 'Show fewer'
                      : `+${availableGenres.length - GENRE_CHIP_LIMIT} more`
                  }}
                </v-btn>
              </div>

              <div class="text-caption text-medium-emphasis mb-3">
                Showing {{ visibleGames.length }} of {{ totalGames }}
              </div>

              <div v-if="!visibleGames.length" class="empty-desc py-4">
                No games match your filters.
              </div>
              <v-virtual-scroll
                v-else
                :items="visibleGames"
                item-height="104"
                max-height="72vh"
              >
                <template #default="{ item: entry }">
                  <v-list-item class="game-item mb-2">
                    <template #prepend>
                      <v-avatar
                        rounded="0"
                        size="56"
                        color="surface-variant"
                        class="mr-3"
                      >
                        <v-img
                          v-if="entry.game.thumbnail"
                          :src="entry.game.thumbnail"
                          :alt="entry.game.name"
                        />
                        <v-icon v-else size="32"
                          >$gamepadVariantOutline</v-icon
                        >
                      </v-avatar>
                    </template>
                    <v-list-item-title>{{ entry.game.name }}</v-list-item-title>
                    <div
                      v-if="entry.game.categories?.length"
                      class="d-flex flex-wrap align-center gap-1 mt-1 mb-1"
                    >
                      <v-chip
                        v-for="cat in entry.game.categories.slice(0, 4)"
                        :key="cat"
                        size="x-small"
                        variant="tonal"
                        color="info"
                        >{{ cat }}</v-chip
                      >
                      <span
                        v-if="entry.game.categories.length > 4"
                        class="text-caption text-medium-emphasis"
                        >+{{ entry.game.categories.length - 4 }}</span
                      >
                    </div>
                    <v-rating
                      v-if="!isFriendView"
                      :model-value="opinions[entry.game.id]?.rating ?? 0"
                      hover
                      size="small"
                      color="warning"
                      active-color="warning"
                      @update:model-value="
                        (val) => updateGameRating(entry.game, val)
                      "
                    />
                    <div
                      v-if="formatGameInfo(entry.game)"
                      class="text-caption text-medium-emphasis"
                    >
                      {{ formatGameInfo(entry.game) }}
                    </div>
                    <div class="event-actions">
                      <v-btn
                        icon
                        size="small"
                        variant="tonal"
                        color="accent"
                        :href="`https://boardgamegeek.com/boardgame/${entry.game.id}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open on BGG"
                        title="Open on BGG"
                      >
                        <v-icon>$openInNew</v-icon>
                      </v-btn>
                      <v-btn
                        v-if="!isFriendView"
                        icon
                        size="small"
                        variant="tonal"
                        :color="
                          expandedItems.has(entry.id) ? 'primary' : 'accent'
                        "
                        :aria-label="
                          expandedItems.has(entry.id)
                            ? 'Hide note'
                            : 'Edit note'
                        "
                        :title="
                          expandedItems.has(entry.id)
                            ? 'Hide note'
                            : 'Edit note'
                        "
                        @click.stop="toggleExpanded(entry.id)"
                      >
                        <v-icon>$noteTextOutline</v-icon>
                      </v-btn>
                      <v-btn
                        v-if="!isFriendView"
                        icon
                        size="small"
                        variant="tonal"
                        color="error"
                        aria-label="Remove from collection"
                        title="Remove from collection"
                        @click.stop="removeGameFromCollection(entry.id)"
                      >
                        <v-icon>$deleteOutline</v-icon>
                      </v-btn>
                    </div>
                    <v-textarea
                      v-if="!isFriendView && expandedItems.has(entry.id)"
                      :model-value="opinions[entry.game.id]?.privateNote ?? ''"
                      label="Private note"
                      variant="outlined"
                      density="compact"
                      rows="2"
                      hide-details
                      class="mt-2"
                      @blur="
                        (e: FocusEvent) =>
                          updateGameNote(
                            entry.game,
                            (e.target as HTMLTextAreaElement).value
                          )
                      "
                    />
                  </v-list-item>
                </template>
              </v-virtual-scroll>
            </div>

            <!-- Also rated: games with opinions but not in collection (owner only) -->
            <template v-if="!isFriendView && alsoRatedGames.length">
              <v-divider class="my-4" />
              <div class="section-label mb-3">Also rated</div>
              <v-list>
                <template v-for="entry in alsoRatedGames" :key="entry.gameId">
                  <v-list-item class="game-item mb-2">
                    <v-list-item-title>{{ entry.name }}</v-list-item-title>
                    <v-rating
                      :model-value="entry.rating ?? 0"
                      hover
                      size="small"
                      color="warning"
                      active-color="warning"
                      @update:model-value="
                        (val) =>
                          updateOpinionRating(entry.gameId, entry.name, val)
                      "
                    />
                    <div class="event-actions">
                      <v-btn
                        icon
                        size="small"
                        variant="tonal"
                        :color="
                          expandedItems.has(entry.gameId) ? 'primary' : 'accent'
                        "
                        :aria-label="
                          expandedItems.has(entry.gameId)
                            ? 'Hide note'
                            : 'Edit note'
                        "
                        :title="
                          expandedItems.has(entry.gameId)
                            ? 'Hide note'
                            : 'Edit note'
                        "
                        @click.stop="toggleExpanded(entry.gameId)"
                      >
                        <v-icon>$noteTextOutline</v-icon>
                      </v-btn>
                      <v-btn
                        icon
                        size="small"
                        variant="tonal"
                        color="success"
                        aria-label="Add to collection"
                        title="Add to collection"
                        @click.stop="addOpinionGameToCollection(entry)"
                      >
                        <v-icon>$plusCircle</v-icon>
                      </v-btn>
                      <v-btn
                        icon
                        size="small"
                        variant="tonal"
                        color="error"
                        aria-label="Delete rating"
                        title="Delete rating"
                        @click.stop="deleteOpinion(entry.gameId)"
                      >
                        <v-icon>$deleteOutline</v-icon>
                      </v-btn>
                    </div>
                  </v-list-item>
                  <v-list-item
                    v-if="expandedItems.has(entry.gameId)"
                    class="px-4 pb-2"
                  >
                    <v-textarea
                      :model-value="entry.privateNote ?? ''"
                      label="Private note"
                      variant="outlined"
                      density="compact"
                      rows="2"
                      hide-details
                      @blur="
                        (e: FocusEvent) =>
                          updateOpinionNote(
                            entry.gameId,
                            entry.name,
                            (e.target as HTMLTextAreaElement).value
                          )
                      "
                    />
                  </v-list-item>
                </template>
              </v-list>
            </template>
          </div>

          <!-- Add to collection search (owner only) -->
          <GameSearch
            v-else-if="activeArea === 'addGame'"
            :ids-in-collection="idsInCollection"
            :add-to-collection="addToCollection"
            @error="onGameSearchError"
          />

          <!-- Rate a game search (owner only) -->
          <div v-else-if="activeArea === 'addOpinion'">
            <v-autocomplete
              v-model="opinionSelectedItem"
              v-model:search="opinionSearchInput"
              :items="opinionSearchItems"
              :loading="opinionSearchLoading"
              item-title="displayname"
              item-value="id"
              label="Board game search"
              placeholder="Start typing to search"
              :hint="`Type at least ${constants.MinSearchLength} characters`"
              prepend-icon="$databaseSearch"
              return-object
              class="mb-4"
              @click="opinionSelectedItem = null"
            />
            <v-card v-if="opinionSelectedItem" variant="outlined" class="pa-4">
              <div class="d-flex align-center mb-3">
                <span class="font-weight-medium">{{
                  opinionSelectedItem.name
                }}</span>
                <v-spacer />
                <v-btn
                  size="small"
                  icon
                  variant="text"
                  @click.stop="opinionSelectedItem = null"
                >
                  <v-icon>$close</v-icon>
                </v-btn>
              </div>
              <v-rating
                v-model="pendingRating"
                hover
                color="secondary"
                active-color="secondary"
                class="mb-3"
              />
              <v-textarea
                v-model="pendingNote"
                label="Private note"
                variant="outlined"
                density="compact"
                rows="3"
                hide-details
                class="mb-3"
              />
              <div class="d-flex gap-2">
                <v-btn
                  color="primary"
                  size="small"
                  @click.stop="saveOpinionEntry"
                  >Save</v-btn
                >
                <v-btn
                  variant="text"
                  size="small"
                  @click.stop="opinionSelectedItem = null"
                  >Cancel</v-btn
                >
                <v-spacer />
                <v-btn
                  v-if="
                    opinionSelectedItem &&
                    !idsInCollection.includes(opinionSelectedItem.id)
                  "
                  color="success"
                  size="small"
                  @click.stop="addSelectedOpinionGameToCollection"
                >
                  <v-icon start>$plusCircle</v-icon>Add to Collection
                </v-btn>
              </div>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
      <Snackbar ref="snackbar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  ref as dbRef,
  onValue,
  push,
  set,
  remove,
  get,
} from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import Snackbar from '~/components/Snackbar.vue'
import GameSearch from '~/components/GameSearch.vue'
import helpers from '~/helpers/helpers'
import routes from '~/helpers/routes'
import type {
  DisplayableItemType,
  Game,
  GameOpinion,
  BoardGameSearchResult,
} from '~/helpers/types'
import constants from '~/helpers/constants'
import {
  collectionGenres,
  filterAndSortCollection,
  type CollectionSort,
} from '~/helpers/collection'

useHead({ title: 'Game collection' })

type ActiveArea = 'collection' | 'addGame' | 'addOpinion'

const route = useRoute()
const userStore = useUserStore()
const nuxtApp = useNuxtApp()
const db = nuxtApp.$db
const $functions = nuxtApp.$functions
const logEvent = nuxtApp.$logEvent
const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)

const ownUid = userStore.user!.uid
const viewingUid = computed(
  () => (route.query.uid as string | undefined) ?? ownUid
)
const isFriendView = computed(() => viewingUid.value !== ownUid)

const friendName = ref('')
const collection = ref<Record<string, Game> | null>(null)
const opinions = ref<Record<string, GameOpinion>>({})
const loading = ref(true)
const filterGames = ref<string | null>('')
const selectedGenres = ref<string[]>([])
const sortBy = ref<CollectionSort>('name')
const showAllGenres = ref(false)
// "My rating" sort only makes sense for your own collection.
const sortOptions = computed(() => [
  { title: 'Name', value: 'name' },
  ...(isFriendView.value ? [] : [{ title: 'My rating', value: 'rating' }]),
  { title: 'Recently added', value: 'recent' },
])
const GENRE_CHIP_LIMIT = 12
const activeArea = ref<ActiveArea>('collection')
const expandedItems = ref(new Set<string>())

let unsubCollection: (() => void) | null = null
let unsubOpinions: (() => void) | null = null

const pageTitle = computed(() => {
  if (isFriendView.value)
    return friendName.value ? `${friendName.value}'s Collection` : 'Collection'
  if (activeArea.value === 'addGame') return 'Add game'
  if (activeArea.value === 'addOpinion') return 'Rate a Game'
  return 'Game collection'
})

// Distinct genres present in the collection, alphabetized — drives the chips.
const availableGenres = computed(() => collectionGenres(collection.value))
const visibleGenres = computed(() =>
  showAllGenres.value
    ? availableGenres.value
    : availableGenres.value.slice(0, GENRE_CHIP_LIMIT)
)

const totalGames = computed(() =>
  collection.value ? Object.keys(collection.value).length : 0
)

// Text filter + genre facets + sort, as an honest ordered array. Logic lives in
// helpers/collection.ts (unit-tested); this just wires in the reactive inputs.
const visibleGames = computed(() =>
  filterAndSortCollection(collection.value, {
    text: filterGames.value ?? '',
    genres: new Set(selectedGenres.value),
    sortBy: sortBy.value,
    ratingFor: (id) => opinions.value[id]?.rating ?? 0,
  })
)

const idsInCollection = computed(() =>
  collection.value ? Object.values(collection.value).map((g) => g.id) : []
)

const alsoRatedGames = computed(() => {
  const inCollection = new Set(idsInCollection.value)
  return Object.entries(opinions.value)
    .filter(([gameId]) => !inCollection.has(gameId))
    .map(([gameId, op]) => ({ gameId, ...op }))
})

// --- Opinion search state ---
const opinionSearchItems = ref<BoardGameSearchResult[]>([])
const opinionSearchLoading = ref(false)
const opinionSelectedItem = ref<BoardGameSearchResult | null>(null)
const opinionSearchInput = ref('')
const pendingRating = ref(0)
const pendingNote = ref('')
let opinionSearchTimer: number | undefined

watch(opinionSearchInput, (input) => {
  if (opinionSelectedItem.value) return
  clearTimeout(opinionSearchTimer)
  opinionSearchTimer = window.setTimeout(
    () => fetchOpinionSearch(input),
    constants.DebounceThrottleInMs
  )
})

watch(opinionSelectedItem, (item) => {
  if (!item) return
  const existing = opinions.value[item.id]
  pendingRating.value = existing?.rating ?? 0
  pendingNote.value = existing?.privateNote ?? ''
})

async function fetchOpinionSearch(input: string) {
  if (!input || input.length < constants.MinSearchLength) {
    opinionSearchItems.value = []
    return
  }
  opinionSearchLoading.value = true
  try {
    const bggSearchFn = httpsCallable<
      { query: string; type: string },
      { items: { id: string; name: string; yearpublished: string | null }[] }
    >($functions, 'bggSearch')
    const result = await bggSearchFn({
      query: input,
      type: constants.BggBoardGameType,
    })
    opinionSearchItems.value = (result.data.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      displayname:
        item.name + (item.yearpublished ? ` (${item.yearpublished})` : ''),
      yearpublished: item.yearpublished ?? '0',
    }))
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  } finally {
    opinionSearchLoading.value = false
  }
}

onMounted(async () => {
  if (isFriendView.value) {
    try {
      const snap = await get(dbRef(db, `profiles/${viewingUid.value}/name`))
      friendName.value = snap.val() ?? 'Friend'
    } catch {
      friendName.value = 'Friend'
    }
  }

  const collRef = dbRef(db, `users/${viewingUid.value}/collection`)
  unsubCollection = onValue(
    collRef,
    (snapshot) => {
      collection.value = snapshot.val()
      loading.value = false
    },
    (err) => {
      loading.value = false
      snackbar.value?.showSnackbarWithMessage(
        helpers.handleError(err).message,
        true
      )
    }
  )

  if (!isFriendView.value) {
    const opRef = dbRef(db, `users/${ownUid}/gameOpinions`)
    unsubOpinions = onValue(opRef, (snapshot) => {
      opinions.value = snapshot.val() ?? {}
    })
  }

  setTimeout(() => {
    loading.value = false
  }, constants.LoadingTimeoutInMs)
})

onUnmounted(() => {
  unsubCollection?.()
  unsubOpinions?.()
})

function toggleExpanded(id: string) {
  const next = new Set(expandedItems.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedItems.value = next
}

function openRateArea() {
  opinionSelectedItem.value = null
  opinionSearchInput.value = ''
  opinionSearchItems.value = []
  pendingRating.value = 0
  pendingNote.value = ''
  activeArea.value = 'addOpinion'
}

type BggGameMeta = {
  name?: string
  thumbnail?: string
  minplayers?: string | null
  maxplayers?: string | null
  minplaytime?: string | null
  maxplaytime?: string | null
  yearpublished?: string | null
  categories?: string[] | null
}

function formatGameInfo(game: Game): string {
  const parts: string[] = []
  const {
    minplayers: minP,
    maxplayers: maxP,
    minplaytime: minT,
    maxplaytime: maxT,
  } = game
  if (minP && maxP) {
    parts.push(minP === maxP ? `${minP} players` : `${minP}–${maxP} players`)
  } else if (minP ?? maxP) {
    parts.push(`${minP ?? maxP} players`)
  }
  if (minT && maxT) {
    parts.push(minT === maxT ? `${minT} min` : `${minT}–${maxT} min`)
  } else if (minT ?? maxT) {
    parts.push(`${minT ?? maxT} min`)
  }
  return parts.join(' · ')
}

function normalizeThumb(url: string | null | undefined): string {
  if (!url) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

function buildGame(id: string, data: BggGameMeta, fallbackName: string): Game {
  const game: Game = {
    id,
    name: data.name ?? fallbackName,
    thumbnail: normalizeThumb(data.thumbnail),
  }
  if (data.minplayers) game.minplayers = data.minplayers
  if (data.maxplayers) game.maxplayers = data.maxplayers
  if (data.minplaytime) game.minplaytime = data.minplaytime
  if (data.maxplaytime) game.maxplaytime = data.maxplaytime
  if (data.yearpublished && data.yearpublished !== '0')
    game.yearpublished = data.yearpublished
  if (data.categories?.length) game.categories = data.categories
  return game
}

async function fetchAndCollect(
  id: string,
  fallbackName: string
): Promise<void> {
  const fn = httpsCallable<{ ids: string[] }, { items: BggGameMeta[] }>(
    $functions,
    'bggThing'
  )
  const { data } = await fn({ ids: [id] })
  const item = data.items?.[0] ?? {}
  await set(
    push(dbRef(db, `users/${ownUid}/collection`)),
    buildGame(id, item, fallbackName)
  )
}

async function addToCollection(item: DisplayableItemType) {
  try {
    await set(
      push(dbRef(db, `users/${ownUid}/collection`)),
      buildGame(item.id, item, item.name)
    )
    logEvent('game_added_to_collection', { name: item.name })
    snackbar.value?.showSnackbarWithMessage(
      `${item.name} added to collection`,
      false
    )
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function removeGameFromCollection(id: string) {
  try {
    await remove(dbRef(db, `users/${ownUid}/collection/${id}`))
    logEvent('game_removed_from_collection')
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function persistOpinion(
  gameId: string,
  name: string,
  rating: number,
  privateNote: string
) {
  const hasRating = rating > 0
  const hasNote = privateNote.trim() !== ''
  if (!hasRating && !hasNote) {
    if (opinions.value[gameId])
      await remove(dbRef(db, `users/${ownUid}/gameOpinions/${gameId}`))
    return
  }
  const payload: Record<string, unknown> = { name }
  if (hasRating) payload.rating = rating
  if (hasNote) payload.privateNote = privateNote.trim()
  await set(dbRef(db, `users/${ownUid}/gameOpinions/${gameId}`), payload)
}

async function updateGameRating(game: Game, rating: number) {
  try {
    const existing = opinions.value[game.id]
    await persistOpinion(
      game.id,
      game.name,
      rating,
      existing?.privateNote ?? ''
    )
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function updateGameNote(game: Game, note: string) {
  try {
    const existing = opinions.value[game.id]
    await persistOpinion(game.id, game.name, existing?.rating ?? 0, note)
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function updateOpinionRating(
  gameId: string,
  name: string,
  rating: number
) {
  try {
    const existing = opinions.value[gameId]
    await persistOpinion(gameId, name, rating, existing?.privateNote ?? '')
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function updateOpinionNote(gameId: string, name: string, note: string) {
  try {
    const existing = opinions.value[gameId]
    await persistOpinion(gameId, name, existing?.rating ?? 0, note)
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function deleteOpinion(gameId: string) {
  try {
    await remove(dbRef(db, `users/${ownUid}/gameOpinions/${gameId}`))
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function addOpinionGameToCollection(entry: {
  gameId: string
  name: string
}) {
  try {
    await fetchAndCollect(entry.gameId, entry.name)
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function saveOpinionEntry() {
  if (!opinionSelectedItem.value) return
  try {
    await persistOpinion(
      opinionSelectedItem.value.id,
      opinionSelectedItem.value.name,
      pendingRating.value,
      pendingNote.value
    )
    opinionSelectedItem.value = null
    activeArea.value = 'collection'
    snackbar.value?.showSnackbarWithMessage('Opinion saved', false)
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

async function addSelectedOpinionGameToCollection() {
  if (!opinionSelectedItem.value) return
  try {
    await fetchAndCollect(
      opinionSelectedItem.value.id,
      opinionSelectedItem.value.name
    )
    opinionSelectedItem.value = null
    activeArea.value = 'collection'
  } catch (err) {
    snackbar.value?.showSnackbarWithMessage(
      helpers.handleError(err).message,
      true
    )
  }
}

function onGameSearchError(error: Error) {
  snackbar.value?.showSnackbarWithMessage(error.message, true)
}
</script>

<style scoped>
/* No deal-in stagger here: rows are virtualized and recycled on scroll, so a
   per-row entry animation would replay continuously as you scroll. */
.game-item {
  border-radius: 6px;
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.game-item:hover {
  background: rgba(200, 134, 10, 0.07);
  transform: translateX(3px);
}
/* Allow titles to wrap to a second line rather than clipping with ellipsis */
.game-item :deep(.v-list-item-title) {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}
/* Empty rating stars: ≥3:1 against the card for WCAG 1.4.11 (UI components) */
.game-item :deep(.v-rating .v-btn:not(.v-btn--active) .v-icon) {
  color: rgba(200, 134, 10, 0.7) !important;
}
/* Add row gap between wrapped chip rows in the genre filter */
.genre-chip-group :deep(.v-slide-group__content) {
  row-gap: 6px;
}
</style>
