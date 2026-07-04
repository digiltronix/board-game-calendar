<template>
  <div class="hero-wrapper">
    <div class="hero-bg" />
    <v-row justify="center" align="start">
      <v-col cols="12" sm="11" md="8" lg="6">
        <v-card class="hero-card">
          <v-card-text class="text-center pa-8 pb-6">
            <div class="mb-5">
              <BGCLogo />
            </div>
            <h1 class="hero-title mb-3">Board Game Calendar</h1>
            <div class="hero-ornament mb-4" aria-hidden="true">
              <span class="hero-rule" />
              <span class="hero-pip" />
              <span class="hero-rule" />
            </div>
            <p class="hero-subtitle mb-2">
              Schedule board game nights around the games you love — not the
              ones that attract the least common denominator.
            </p>
            <p class="hero-body mb-6">
              Build your collection, add friends, and invite them to play
              specific games. No more compromising on game night.
            </p>
            <v-btn
              color="primary"
              size="large"
              to="/signin"
              class="hero-cta"
              elevation="8"
            >
              Get started
              <v-icon end>$arrowRight</v-icon>
            </v-btn>
          </v-card-text>

          <v-divider style="border-color: rgba(200, 134, 10, 0.15)" />

          <v-card-text class="pa-6 pt-5">
            <v-row>
              <v-col
                v-for="feature in features"
                :key="feature.icon"
                cols="12"
                sm="4"
              >
                <div class="feature-item text-center pa-3">
                  <v-icon
                    size="32"
                    color="primary"
                    class="mb-2"
                    style="opacity: 0.75"
                  >
                    {{ feature.icon }}
                  </v-icon>
                  <div class="feature-title">{{ feature.title }}</div>
                  <div class="feature-desc">{{ feature.desc }}</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Welcome' })

const features = [
  {
    icon: '$cardsOutline',
    title: 'Your collection',
    desc: 'Catalog your board games with ratings and notes.',
  },
  {
    icon: '$accountGroup',
    title: 'Find friends',
    desc: 'Connect with fellow board game enthusiasts.',
  },
  {
    icon: '$diceMultiple',
    title: 'Schedule nights',
    desc: 'Plan gatherings around the games you love.',
  },
]
</script>

<style scoped>
.hero-wrapper {
  position: relative;
  padding-top: 24px;
}

.hero-bg {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(200, 134, 10, 0.06) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.hero-card {
  overflow: visible;
}

.hero-title {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #c8860a;
  text-shadow:
    0 0 20px rgba(200, 134, 10, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.5);
  line-height: 1.25;
}

.hero-ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.hero-rule {
  display: block;
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(200, 134, 10, 0.6));
}

.hero-rule:last-child {
  background: linear-gradient(90deg, rgba(200, 134, 10, 0.6), transparent);
}

.hero-pip {
  display: block;
  width: 8px;
  height: 8px;
  background: #c8860a;
  transform: rotate(45deg);
  box-shadow: 0 0 10px rgba(200, 134, 10, 0.6);
}

.hero-subtitle {
  font-family: 'Lora', Georgia, serif;
  font-size: 1.05rem;
  color: rgba(240, 223, 196, 0.85);
  line-height: 1.7;
}

.hero-body {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.98rem;
  color: rgba(240, 223, 196, 0.7);
  line-height: 1.7;
}

.hero-cta {
  font-family: 'Fraunces', Georgia, serif !important;
  font-weight: 700 !important;
  letter-spacing: 0.1em !important;
  padding: 0 32px;
  transition: all 0.25s ease;
}

.hero-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(200, 134, 10, 0.35) !important;
}

.feature-item {
  border-radius: 8px;
}

.feature-title {
  font-family: 'Lora', Georgia, serif;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.01em;
  margin-bottom: 6px;
  color: rgba(240, 223, 196, 0.92);
}

.feature-desc {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.88rem;
  color: rgba(240, 223, 196, 0.65);
  line-height: 1.6;
}
</style>
