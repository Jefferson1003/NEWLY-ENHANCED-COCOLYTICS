<script setup>
import { computed, onMounted, ref } from 'vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { fetchClients, restoreClient } from '../../services/api';

const users = ref([]);
const loading = ref(true);
const feedback = ref('');
const showRestoreConfirm = ref(false);
const targetUser = ref(null);
const searchText = ref('');

const ADMIN_USERS_UPDATED_EVENT = 'cocolytics-admin-users-updated';

const archivedUsers = computed(() => {
  const keyword = String(searchText.value || '').trim().toLowerCase();

  return users.value
    .filter((user) => user.isArchived)
    .filter((user) => {
      if (!keyword) return true;
      const name = String(user.fullName || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      const status = String(user.status || '').toLowerCase();
      return name.includes(keyword)
        || email.includes(keyword)
        || role.includes(keyword)
        || status.includes(keyword);
    });
});

async function loadUsers() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchClients();
    users.value = data.clients || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

function requestRestore(user) {
  targetUser.value = user;
  showRestoreConfirm.value = true;
}

function cancelRestore() {
  showRestoreConfirm.value = false;
  targetUser.value = null;
}

async function confirmRestore() {
  if (!targetUser.value) return;
  const selectedId = targetUser.value.id;
  cancelRestore();

  try {
    await restoreClient(selectedId);
    await loadUsers();
    window.dispatchEvent(new CustomEvent(ADMIN_USERS_UPDATED_EVENT));
  } catch (error) {
    feedback.value = error.message;
  }
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function toStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return '-';
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

onMounted(loadUsers);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Archived Users</p>
      <h2>Restore Archived Accounts</h2>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="filters">
      <input
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="Search name, email, role, status"
      />
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Archived At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6">Loading archived users...</td>
          </tr>
          <tr v-for="user in archivedUsers" :key="user.id">
            <td>{{ user.fullName }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role }}</td>
            <td>{{ toStatusLabel(user.status) }}</td>
            <td>{{ formatDate(user.archivedAt) }}</td>
            <td>
              <button class="restore-btn" @click="requestRestore(user)">
                Restore User
              </button>
            </td>
          </tr>
          <tr v-if="!loading && archivedUsers.length === 0">
            <td colspan="6">No archived users found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmationModal
      :visible="showRestoreConfirm"
      title="Confirm Restore"
      :message="`Restore ${targetUser?.fullName || 'this user'} to their previous role and access?`"
      confirm-label="Yes, Restore"
      cancel-label="Cancel"
      @confirm="confirmRestore"
      @cancel="cancelRestore"
    />
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

.filters {
  margin-top: 0.8rem;
}

.search-input {
  width: min(100%, 420px);
  border: 1px solid rgba(121, 220, 183, 0.35);
  border-radius: 10px;
  background: rgba(7, 25, 33, 0.88);
  color: #eefff8;
  padding: 0.58rem 0.68rem;
  font: inherit;
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
  min-width: 740px;
  border-collapse: collapse;
}

th,
td {
  padding: 0.8rem;
  border-bottom: 1px solid rgba(138, 209, 255, 0.16);
  text-align: left;
}

.restore-btn {
  border: 1px solid rgba(126, 226, 191, 0.42);
  border-radius: 8px;
  background: rgba(22, 117, 90, 0.78);
  color: #edfff6;
  padding: 0.4rem 0.7rem;
  font-weight: 700;
  cursor: pointer;
}
</style>
