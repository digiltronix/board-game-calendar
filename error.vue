<template>
  <v-app>
    <v-container class="fill-height" fluid>
      <v-row justify="center" align="center">
        <v-col cols="12" sm="8" md="6" class="text-center">
          <v-icon size="80" color="primary" class="mb-4" style="opacity: 0.4">
            {{
              error.statusCode === 404
                ? '$mapMarkerQuestion'
                : '$alertCircleOutline'
            }}
          </v-icon>
          <h1 class="error-code mb-2">{{ error.statusCode || 'Error' }}</h1>
          <p class="error-message mb-6">
            {{
              error.statusCode === 404
                ? "This page doesn't exist."
                : 'Something went wrong.'
            }}
          </p>
          <v-btn color="primary" variant="elevated" to="/">
            <v-icon start>$home</v-icon>Go home
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
defineProps<{ error: { statusCode?: number; message?: string } }>()
</script>

<style scoped>
.error-code {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 3.25rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #c8860a;
  text-shadow:
    0 0 20px rgba(200, 134, 10, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.5);
}
.error-message {
  font-family: 'Lora', Georgia, serif;
  font-size: 1.05rem;
  color: rgba(240, 223, 196, 0.8);
}
</style>
