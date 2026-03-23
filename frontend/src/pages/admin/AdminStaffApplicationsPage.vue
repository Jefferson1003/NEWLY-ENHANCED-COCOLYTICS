<script setup>
import { computed, onMounted, ref } from 'vue';
import { acceptStaff, fetchClients } from '../../services/api';

const users = ref([]);
const loading = ref(true);
const feedback = ref('');

const pendingStaff = computed(() => users.value.filter((user) => user.status === 'pending_staff'));

async function loadUsers() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchClients();
    users.value = data.clients;
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function onAcceptStaff(id) {
  try {
    await acceptStaff(id);
    await loadUsers();
  } catch (error) {
    feedback.value = error.message;
  }
}

onMounted(loadUsers);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Staff Applications</p>
      <h2>Pending Staff Requests</h2>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="cards">
      <article v-if="loading" class="card">Loading staff applications...</article>
      <article v-for="user in pendingStaff" :key="user.id" class="card">
        <p class="name">{{ user.fullName }}</p>
        <p>{{ user.email }}</p>
        <p>Status: {{ user.status }}</p>
        <button @click="onAcceptStaff(user.id)">Accept as Staff</button>
      </article>
      <article v-if="!loading && pendingStaff.length === 0" class="card">No pending staff applications.</article>
    </div>
  </section>
</template>

<style scoped>
.page {
  color: #e8f4ff;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #8dd7ff;
}

h2 {
  margin: 0.5rem 0 0;
  font-size: 1.45rem;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffbac7;
}

.cards {
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  border: 1px solid rgba(138, 210, 255, 0.2);
  border-radius: 12px;
  background: rgba(9, 31, 48, 0.78);
  padding: 0.85rem;
}

.name {
  margin: 0;
  font-weight: 800;
}

button {
  margin-top: 0.6rem;
  border: 1px solid rgba(131, 227, 194, 0.42);
  border-radius: 8px;
  background: rgba(28, 86, 132, 0.85);
  color: #eff8ff;
  padding: 0.45rem 0.7rem;
  font-weight: 700;
  cursor: pointer;
}
</style>
