<script setup>
import { computed, onMounted, ref } from 'vue'

const deferredPrompt = ref(null)
const installReady = ref(false)
const installResult = ref('')
const year = new Date().getFullYear()

const installLabel = computed(() =>
  installReady.value ? 'Install App' : 'Install Not Available Yet'
)

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event
    installReady.value = true
  })

  window.addEventListener('appinstalled', () => {
    installResult.value = 'App installed successfully.'
    installReady.value = false
    deferredPrompt.value = null
  })
})

async function installApp() {
  if (!deferredPrompt.value) {
    return
  }

  deferredPrompt.value.prompt()
  const choiceResult = await deferredPrompt.value.userChoice
  installResult.value =
    choiceResult.outcome === 'accepted'
      ? 'Install prompt accepted.'
      : 'Install prompt dismissed.'
  deferredPrompt.value = null
  installReady.value = false
}
</script>

<template>
  <main class="shell">
    <section class="card">
      <p class="eyebrow">Cocolytics Enhanced</p>
      <h1>Vue Frontend Ready</h1>
      <p class="lead">
        This frontend is configured as a Progressive Web App, so it can be installed on desktop and mobile.
      </p>

      <div class="cta-row">
        <button :disabled="!installReady" @click="installApp">
          {{ installLabel }}
        </button>
        <a href="http://localhost:4000/api/health" target="_blank" rel="noreferrer">Check Backend Health</a>
      </div>

      <p v-if="installResult" class="status">{{ installResult }}</p>
    </section>
  </main>
  <footer class="footer">{{ year }} Cocolytics</footer>
</template>
