<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchClients } from '../../services/api';

const clients = ref([]);
const loading = ref(true);
const feedback = ref('');

const pendingClients = computed(() => clients.value.filter((client) => client.status === 'pending_client').length);
const pendingStaff = computed(() => clients.value.filter((client) => client.status === 'pending_staff').length);
const acceptedClients = computed(() => clients.value.filter((client) => client.status === 'accepted_client').length);
const totalUsers = computed(() => clients.value.length);

async function loadClients() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchClients();
    clients.value = data.clients;
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadClients);
</script>

<template>
  <section class="admin-page">
    <header class="admin-top">
      <p class="kicker">Dashboard</p>
      <h2>Admin Overview</h2>
      <p class="summary">Track client approvals and staff requests at a glance.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="cards">
      <article class="metric">
        <p class="metric-label">Total Users</p>
        <p class="metric-value">{{ totalUsers }}</p>
      </article>
      <article class="metric">
        <p class="metric-label">Pending Clients</p>
        <p class="metric-value">{{ pendingClients }}</p>
      </article>
      <article class="metric">
        <p class="metric-label">Pending Staff</p>
        <p class="metric-value">{{ pendingStaff }}</p>
      </article>
      <article class="metric">
        <p class="metric-label">Accepted Clients</p>
        <p class="metric-value">{{ acceptedClients }}</p>
      </article>
    </div>

    <div class="recent-list">
      <h3>Recent Registrations</h3>
      <ul>
        <li v-if="loading">Loading...</li>
        <li v-for="client in clients.slice(0, 5)" :key="client.id">
          <span>{{ client.fullName }}</span>
          <span>{{ client.status }}</span>
        </li>
        <li v-if="!loading && clients.length === 0">No registered clients yet.</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  min-height: 100%;
  color: #e8f4ff;
}

.kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #87d6ff;
}

h2 {
  margin: 0.45rem 0 0;
  font-size: 1.6rem;
}

.summary {
  margin: 0.45rem 0 0;
  color: #c3def6;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffb5c3;
}

.cards {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.8rem;
}

.metric {
  border: 1px solid rgba(137, 210, 255, 0.22);
  border-radius: 12px;
  background: rgba(10, 32, 47, 0.78);
  padding: 0.8rem;
}

.metric-label {
  margin: 0;
  color: #a6d9ff;
  font-size: 0.8rem;
}

.metric-value {
  margin: 0.45rem 0 0;
  font-size: 1.55rem;
  font-weight: 800;
}

.recent-list {
  margin-top: 1rem;
  border: 1px solid rgba(137, 210, 255, 0.22);
  border-radius: 12px;
  background: rgba(10, 32, 47, 0.78);
  padding: 0.8rem;
}

h3 {
  margin: 0;
  font-size: 1rem;
}

ul {
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

li {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  border: 1px solid rgba(136, 209, 255, 0.14);
  border-radius: 8px;
  padding: 0.55rem 0.6rem;
  font-size: 0.86rem;
}
</style>
