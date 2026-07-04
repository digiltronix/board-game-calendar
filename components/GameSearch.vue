<template>
  <div>
    <v-autocomplete
      ref="boardGameSearch"
      v-model="selectedItem"
      v-model:search="searchInput"
      :items="searchResults"
      :loading="isLoading"
      item-title="displayname"
      item-value="id"
      label="Board game search"
      placeholder="Start typing to search"
      :hint="`Type at least ${constants.MinSearchLength} characters`"
      prepend-icon="$databaseSearch"
      return-object
      @blur="displayEntries"
      @keyup.enter="searchEnterPressed"
      @click="resetData"
    />
    <v-list>
      <v-list-item v-for="(item, i) in entriesToShow" :key="i" class="search-result-item mb-2">
        <template #prepend>
          <v-avatar rounded="0" size="56" color="surface-variant" class="mr-3">
            <v-img
              v-if="item.thumbnail"
              :src="item.thumbnail"
              :alt="item.name"
            />
            <v-icon v-else size="32">$gamepadVariantOutline</v-icon>
          </v-avatar>
        </template>

        <v-list-item-title>
          {{ item.name }} ({{ item.yearpublished }})
        </v-list-item-title>
        <v-list-item-subtitle v-if="item.description">{{ item.description }}</v-list-item-subtitle>
        <div class="event-actions mt-1">
          <v-btn
            icon
            :disabled="item.incollection"
            size="small"
            variant="tonal"
            color="primary"
            :aria-label="item.incollection ? 'Already in collection' : 'Add to collection'"
            :title="item.incollection ? 'Already in collection' : 'Add to collection'"
            @click.stop="addToCollection(item)"
          >
            <v-icon>$plusCircle</v-icon>
          </v-btn>
          <v-btn
            icon
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            variant="tonal"
            color="accent"
            aria-label="View on BGG"
            title="View on BGG"
          >
            <v-icon>$openInNew</v-icon>
          </v-btn>
        </div>
      </v-list-item>
    </v-list>
    <div v-if="!selectedItem && entriesToShow.length !== searchResults.length" class="text-caption text-medium-emphasis mt-1">
      Showing the top {{ constants.NumberToShow }} matches — refine your search
      to narrow the results.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, toRef } from 'vue'
import type { DisplayableItemType } from '~/helpers/types'
import constants from '~/helpers/constants'
import { useBoardGameSearch } from '~/composables/useBoardGameSearch'

const props = defineProps<{
  idsInCollection: string[]
  addToCollection: (item: DisplayableItemType) => void
}>()

const emit = defineEmits<{ error: [error: Error] }>()

const boardGameSearch = ref<{ blur: () => void } | null>(null)

const {
  searchResults,
  selectedItem,
  searchInput,
  isLoading,
  entriesToShow,
  resetData,
  displayEntries,
} = useBoardGameSearch(toRef(props, 'idsInCollection'), (err) =>
  emit('error', err)
)

function searchEnterPressed() {
  if (!searchResults.value.length) return
  boardGameSearch.value?.blur()
}

watch(selectedItem, () => {
  if (!searchResults.value.length) return
  boardGameSearch.value?.blur()
  displayEntries()
})
</script>

<style scoped>
.search-result-item {
  border-radius: 6px;
  transition: background 0.2s ease;
}
.search-result-item:hover {
  background: rgba(200, 134, 10, 0.07);
}
.search-result-item :deep(.v-list-item-title) {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}
</style>
