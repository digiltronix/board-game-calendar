<template>
  <v-snackbar
    v-model="showSnackbar"
    :color="isError ? 'error' : 'success'"
    rounded="lg"
    location="bottom end"
    role="alert"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>{{ isError ? '$alertCircle' : '$checkCircle' }}</v-icon>
      {{ snackbarText }}
    </div>
    <template #actions>
      <v-btn variant="text" @click="showSnackbar = false"> Close </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const snackbarText = ref('')
const isError = ref(false)
const showSnackbar = ref(false)

function showSnackbarWithMessage(text: string, error: boolean) {
  snackbarText.value = text
  isError.value = error
  showSnackbar.value = true
}

function hideSnackbar() {
  snackbarText.value = ''
  isError.value = false
  showSnackbar.value = false
}

defineExpose({ showSnackbarWithMessage, hideSnackbar })
</script>
