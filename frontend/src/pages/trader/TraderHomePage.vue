<script setup>
import { ref, onMounted } from 'vue';
import { fetchTraderProfile } from '../../services/api';

const profile = ref(null);
const feedback = ref('');

async function loadProfile() {
  try {
    const data = await fetchTraderProfile();
    profile.value = data.user;
  } catch (error) {
    feedback.value = error.message;
  }
}

onMounted(loadProfile);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Trader Dashboard</p>
      <h1>Welcome Trader</h1>
      <p class="email">{{ profile?.email }}</p>
    </header>

    <article id="snapshot" class="panel">
      <h2>Trading Snapshot</h2>
      <ul>
        <li>Open transactions: 6</li>
        <li>New client requests: 4</li>
        <li>Completed deals today: 9</li>
      </ul>
    </article>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.page {
  color: #effff7;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #9cf5cd;
}

h1 {
  margin: 0.45rem 0 0;
  font-size: 1.45rem;
}

.email {
  margin: 0.4rem 0 0;
  color: #c2f7e0;
}

.panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

ul {
  margin: 0.75rem 0 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.45rem;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffbfca;
}
</style>
