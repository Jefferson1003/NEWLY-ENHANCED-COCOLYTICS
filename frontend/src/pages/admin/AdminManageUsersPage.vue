<script setup>
import { computed, onMounted, ref } from 'vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { acceptClient, fetchClients } from '../../services/api';

const users = ref([]);
const loading = ref(true);
const feedback = ref('');
const showAcceptConfirm = ref(false);
const targetUser = ref(null);
const searchText = ref('');
const statusFilter = ref('all');

const ADMIN_USERS_UPDATED_EVENT = 'cocolytics-admin-users-updated';

const filteredUsers = computed(() => {
  const statusValue = String(statusFilter.value || 'all').trim().toLowerCase();
  const keyword = String(searchText.value || '').trim().toLowerCase();

  return users.value.filter((user) => {
    const normalizedStatus = String(user.status || '').toLowerCase();
    const statusMatch = statusValue === 'all' || normalizedStatus === statusValue;

    const name = String(user.fullName || '').toLowerCase();
    const email = String(user.email || '').toLowerCase();
    const role = String(user.role || '').toLowerCase();
    const reason = String(user.staffReason || '').toLowerCase();
    const keywordMatch = !keyword
      || name.includes(keyword)
      || email.includes(keyword)
      || role.includes(keyword)
      || normalizedStatus.includes(keyword)
      || reason.includes(keyword);

    return statusMatch && keywordMatch;
  });
});

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
    window.dispatchEvent(new CustomEvent(ADMIN_USERS_UPDATED_EVENT));
  } catch (error) {
    feedback.value = error.message;
  }
}

function requestAcceptClient(user) {
  targetUser.value = user;
  showAcceptConfirm.value = true;
}

function cancelAcceptClient() {
  showAcceptConfirm.value = false;
  targetUser.value = null;
}

async function confirmAcceptClient() {
  if (!targetUser.value) return;
  const selectedId = targetUser.value.id;
  cancelAcceptClient();
  await onAcceptClient(selectedId);
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

    <div class="filters">
      <input
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="Search name, email, role, status, reason"
      />

      <select v-model="statusFilter" class="status-filter">
        <option value="all">Status: All</option>
        <option value="pending_client">Pending Client</option>
        <option value="accepted_client">Accepted Client</option>
        <option value="pending_staff">Pending Staff</option>
        <option value="trader">Trader</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Staff Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6">Loading users...</td>
          </tr>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.fullName }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role }}</td>
            <td>{{ user.status }}</td>
            <td>{{ user.staffReason || '-' }}</td>
            <td>
              <button
                v-if="user.status === 'pending_client'"
                class="action-btn"
                @click="requestAcceptClient(user)"
              >
                Accept Client
              </button>
            </td>
          </tr>
          <tr v-if="!loading && filteredUsers.length === 0">
            <td colspan="6">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmationModal
      :visible="showAcceptConfirm"
      title="Confirm Client Approval"
      :message="`Approve ${targetUser?.fullName || 'this user'} as client?`"
      confirm-label="Yes, Accept"
      cancel-label="Cancel"
      @confirm="confirmAcceptClient"
      @cancel="cancelAcceptClient"
    />
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

.filters {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 0.55rem;
}

.search-input,
.status-filter {
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

@media (max-width: 700px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
