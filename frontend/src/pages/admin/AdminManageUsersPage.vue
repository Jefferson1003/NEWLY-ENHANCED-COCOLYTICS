<script setup>
import { onMounted, ref } from 'vue';
import { acceptClient, fetchClients } from '../../services/api';

const users = ref([]);
const loading = ref(true);
const feedback = ref('');

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

async function onAcceptClient(id) {
  try {
    await acceptClient(id);
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
      <p class="kicker">Manage Users</p>
      <h2>Client Accounts</h2>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5">Loading users...</td>
          </tr>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.fullName }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role }}</td>
            <td>{{ user.status }}</td>
            <td>
              <button
                v-if="user.status === 'pending_client'"
                class="action-btn"
                @click="onAcceptClient(user.id)"
              >
                Accept Client
              </button>
            </td>
          </tr>
          <tr v-if="!loading && users.length === 0">
            <td colspan="5">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.page {
  color: #e7f3ff;
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

.table-wrap {
  margin-top: 1rem;
  border: 1px solid rgba(139, 211, 255, 0.24);
  border-radius: 12px;
  overflow: auto;
  background: rgba(9, 31, 48, 0.78);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 740px;
}

th,
td {
  padding: 0.8rem;
  border-bottom: 1px solid rgba(138, 209, 255, 0.16);
  text-align: left;
}

.action-btn {
  border: 1px solid rgba(126, 226, 191, 0.42);
  border-radius: 8px;
  background: rgba(22, 117, 90, 0.78);
  color: #edfff6;
  padding: 0.4rem 0.7rem;
  font-weight: 700;
}
</style>
