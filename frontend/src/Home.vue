<script setup>
import { computed, onMounted, ref } from 'vue'
import FooterSection from './components/FooterSection.vue'
import HeaderNav from './components/HeaderNav.vue'
import timberStack1 from './assets/hero/download (3).jpg'
import timberStack2 from './assets/hero/download (2).jpg'
import timberStack3 from './assets/hero/download (1).jpg'

const deferredPrompt = ref(null)
const installReady = ref(false)
const installResult = ref('')

const signalCards = [
  {
    icon: '📈',
    title: 'Realtime Storyboard',
    copy: 'Track campaign lift, app activity, and conversion shifts in one mobile timeline.'
  },
  {
    icon: '🔔',
    title: 'Smart Alerts',
    copy: 'Get threshold alerts only when a metric needs action, not every time it moves.'
  },
  {
    icon: '📦',
    title: 'Offline Snapshots',
    copy: 'Review cached performance snapshots even when your connection drops.'
  }
]

const heroImages = [
  {
    src: timberStack1,
    title: 'Premium hardwood stock'
  },
  {
    src: timberStack2,
    title: 'Precision cut inventory'
  },
  {
    src: timberStack3,
    title: 'Ready-for-delivery boards'
  }
]

const installLabel = computed(() =>
  installReady.value ? 'Install Mobile App' : 'Install Option Waiting'
)

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event
    installReady.value = true
  })

  window.addEventListener('appinstalled', () => {
    installResult.value = 'Cocolytics is installed. You can launch it from your home screen.'
    installReady.value = false
    deferredPrompt.value = null
  })
})

async function installApp() {
  if (!deferredPrompt.value) {
    installResult.value = 'Install banner is not ready yet. Keep browsing for a moment.'
    return
  }

  deferredPrompt.value.prompt()
  const choiceResult = await deferredPrompt.value.userChoice
  installResult.value =
    choiceResult.outcome === 'accepted'
      ? 'Install accepted. Preparing your mobile app experience.'
      : 'Install dismissed. You can trigger it again later.'

  deferredPrompt.value = null
  installReady.value = false
}
</script>

<template>
  <div class="home-shell">
    <div class="bg-layer bg-layer-one" aria-hidden="true"></div>
    <div class="bg-layer bg-layer-two" aria-hidden="true"></div>

    <HeaderNav />

    <main class="home-main">
      <section class="hero reveal-up">
        <p class="hero-tag">Built For Mobile Operators</p>
        <h1>Cocolytics turns quick checks into confident decisions.</h1>
        <p class="hero-copy">
          Monitor momentum, watch important trends, and react faster from one pocket-sized workspace.
        </p>

        <div class="hero-actions">
          <button type="button" :disabled="!installReady" @click="installApp">{{ installLabel }}</button>
          <a href="#features">Explore Features</a>
        </div>

        <p v-if="installResult" class="install-status">{{ installResult }}</p>
      </section>

      <section class="hero-gallery reveal-up delayed">
        <article v-for="(image, index) in heroImages" :key="image.title" class="gallery-card" :style="{ '--delay': `${index * 0.12}s` }">
          <img :src="image.src" :alt="image.title" loading="lazy" />
          <p>{{ image.title }}</p>
        </article>
      </section>

      <section id="features" class="panel reveal-up delayed-more">
        <h2>Focused tools for mobile momentum</h2>
        <p>
          Cocolytics gives your team a compact command center designed for taps, swipes, and quick reads.
        </p>

        <div class="signal-grid">
          <article v-for="item in signalCards" :key="item.title" class="signal-card">
            <h3><span class="card-icon" aria-hidden="true">{{ item.icon }}</span>{{ item.title }}</h3>
            <p>{{ item.copy }}</p>
          </article>
        </div>
      </section>

      <section id="workflow" class="panel reveal-up delayed-last">
        <h2>How teams use it daily</h2>
        <ol>
          <li>Morning check: scan yesterday performance in under 30 seconds.</li>
          <li>Midday pulse: catch unusual changes through smart alerts.</li>
          <li>Evening recap: share concise summaries before close.</li>
        </ol>
      </section>
    </main>

    <FooterSection />
  </div>
</template>

<style scoped>
.home-shell {
  position: relative;
  width: 100%;
  max-width: none;
  margin: 0;
  min-height: 100vh;
  padding: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0;
  color: #ecfff3;
}

.bg-layer {
  position: fixed;
  border-radius: 999px;
  filter: blur(36px);
  opacity: 0.5;
  z-index: -1;
  animation: drift 13s ease-in-out infinite;
}

.bg-layer-one {
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, #31ae89 0%, #0d4f65 70%);
  top: -90px;
  right: -80px;
}

.bg-layer-two {
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, #f4a145 0%, #1b6171 65%);
  bottom: -130px;
  left: -100px;
  animation-delay: -5s;
}

.home-main {
  width: min(100%, 460px);
  margin: 0 auto;
  padding: 7rem 0.8rem 1.2rem;
  display: grid;
  gap: 0.95rem;
  align-content: start;
}

.hero-gallery {
  display: grid;
  gap: 0.6rem;
}

.gallery-card {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(127, 230, 191, 0.36);
  background: rgba(11, 43, 54, 0.7);
  opacity: 0;
  transform: translateY(14px);
  animation: tileIn 0.55s ease forwards;
  animation-delay: var(--delay);
}

.gallery-card img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.gallery-card p {
  margin: 0;
  padding: 0.6rem 0.72rem;
  font-size: 0.8rem;
  color: #d0ffe9;
  font-weight: 600;
}

.hero,
.panel {
  border: 1px solid rgba(102, 198, 167, 0.34);
  background: linear-gradient(150deg, rgba(10, 38, 48, 0.85), rgba(13, 56, 70, 0.65));
  border-radius: 20px;
  padding: 1rem;
}

.hero-tag {
  margin: 0;
  font-size: 0.73rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #95f4c8;
}

h1 {
  margin: 0.45rem 0 0;
  font-size: clamp(1.55rem, 6.5vw, 2.35rem);
  line-height: 1.15;
  color: #ffffff;
}

.hero-copy {
  margin: 0.72rem 0 0;
  color: #d2ffec;
  font-size: 0.96rem;
}

.hero-actions {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

button,
a {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.62rem 0.92rem;
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

button {
  cursor: pointer;
  color: #0a2c35;
  background: linear-gradient(130deg, #9dffc8, #49d6ae);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

a {
  color: #e8fff4;
  border-color: rgba(144, 241, 205, 0.45);
  background: rgba(10, 43, 56, 0.7);
}

button:hover:enabled,
a:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(38, 197, 158, 0.22);
}

.install-status {
  margin: 0.72rem 0 0;
  font-size: 0.78rem;
  color: #b8ffdb;
}

h2 {
  margin: 0;
  font-size: 1.2rem;
}

.panel p {
  margin: 0.55rem 0 0;
  color: #d3fce8;
  font-size: 0.9rem;
}

.signal-grid {
  margin-top: 0.8rem;
  display: grid;
  gap: 0.6rem;
}

.signal-card {
  border-radius: 14px;
  border: 1px solid rgba(138, 240, 200, 0.34);
  padding: 0.75rem;
  background: linear-gradient(140deg, rgba(14, 50, 64, 0.8), rgba(20, 71, 87, 0.46));
}

.signal-card h3 {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: #ebfff6;
  font-size: 0.94rem;
}

.card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 999px;
  background: rgba(55, 178, 141, 0.28);
  font-size: 0.8rem;
}

.signal-card p {
  margin-top: 0.38rem;
  color: #b7f3d9;
  font-size: 0.83rem;
}

ol {
  margin: 0.7rem 0 0;
  padding-left: 1.08rem;
  display: grid;
  gap: 0.45rem;
  color: #c8ffe3;
  font-size: 0.87rem;
}

.reveal-up {
  opacity: 0;
  transform: translateY(22px);
  animation: revealUp 0.7s ease forwards;
}

.delayed {
  animation-delay: 0.15s;
}

.delayed-more {
  animation-delay: 0.3s;
}

.delayed-last {
  animation-delay: 0.45s;
}

@keyframes revealUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(12px, -10px, 0) scale(1.08);
  }
}

@keyframes tileIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 720px) {
  .home-shell {
    width: 100%;
  }

  .home-main {
    width: min(100%, 960px);
    padding: 7.2rem 1.2rem 1.2rem;
  }

  .hero-gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .gallery-card img {
    height: 150px;
  }

  .hero,
  .panel {
    padding: 1.2rem;
  }

  .signal-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
