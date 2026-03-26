<script setup>
import { computed, onMounted, ref } from 'vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import {
  acceptClient,
  fetchClients,
} from '../../services/api';

const users = ref([]);
const loading = ref(true);
const feedback = ref('');
const showAcceptClientConfirm = ref(false);
const showAcceptAllClientConfirm = ref(false);
const targetClientUser = ref(null);

const ADMIN_USERS_UPDATED_EVENT = 'cocolytics-admin-users-updated';

const pendingClients = computed(() => users.value.filter((user) => user.status === 'pending_client'));

const hasPendingClients = computed(() => pendingClients.value.length > 0);

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
  targetClientUser.value = user;
  showAcceptClientConfirm.value = true;
}

function cancelAcceptClient() {
  showAcceptClientConfirm.value = false;
  targetClientUser.value = null;
}

function requestAcceptAllClients() {
  showAcceptAllClientConfirm.value = true;
}

function cancelAcceptAllClients() {
  showAcceptAllClientConfirm.value = false;
}

async function confirmAcceptClient() {
  if (!targetClientUser.value) return;
  const selectedId = targetClientUser.value.id;
  cancelAcceptClient();
  await onAcceptClient(selectedId);
}

async function confirmAcceptAllClients() {
  const clientIds = pendingClients.value.map((user) => user.id);
  cancelAcceptAllClients();

  if (!clientIds.length) {
    return;
  }

  for (const id of clientIds) {
    // Keep this sequential to match the existing single accept-client flow.
    await acceptClient(id);
  }

  await loadUsers();
  window.dispatchEvent(new CustomEvent(ADMIN_USERS_UPDATED_EVENT));
}

onMounted(loadUsers);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Staff Applications</p>
      <h2>Pending Client Requests</h2>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="page-actions">
      <button
        type="button"
        :disabled="loading || !hasPendingClients"
        @click="requestAcceptAllClients"
      >
        Accept All Client Applications
      </button>
    </div>

    <div class="table-wrap">
      <h3>Pending Client Applications</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Why Become Staff</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5">Loading client applications...</td>
          </tr>
          <tr v-for="user in pendingClients" :key="`client-${user.id}`">
            <td>{{ user.fullName }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.status }}</td>
            <td>{{ user.staffReason || '-' }}</td>
            <td>
              <button @click="requestAcceptClient(user)">Accept as Client</button>
            </td>
          </tr>
          <tr v-if="!loading && pendingClients.length === 0">
            <td colspan="5">No pending client applications.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmationModal
      :visible="showAcceptClientConfirm"
      title="Confirm Client Approval"
      :message="`Approve ${targetClientUser?.fullName || 'this user'} as client?`"
      confirm-label="Yes, Accept"
      cancel-label="Cancel"
      @confirm="confirmAcceptClient"
      @cancel="cancelAcceptClient"
    />

    <ConfirmationModal
      :visible="showAcceptAllClientConfirm"
      title="Confirm Client Bulk Approval"
      :message="`Approve all ${pendingClients.length} pending client application(s)?`"
      confirm-label="Yes, Accept All"
      cancel-label="Cancel"
      @confirm="confirmAcceptAllClients"
      @cancel="cancelAcceptAllClients"
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

.page-actions {
  margin-top: 0.9rem;
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.table-wrap {
  margin-top: 1rem;
  border: 1px solid rgba(139, 211, 255, 0.24);
  border-radius: 12px;
  overflow: auto;
  background: rgba(9, 31, 48, 0.78);
}

h3 {
  margin: 0;
  padding: 0.8rem 0.8rem 0;
  font-size: 1rem;
  color: #cbe8ff;
}

table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem;
  border-bottom: 1px solid rgba(138, 209, 255, 0.16);
  text-align: left;
  vertical-align: top;
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
