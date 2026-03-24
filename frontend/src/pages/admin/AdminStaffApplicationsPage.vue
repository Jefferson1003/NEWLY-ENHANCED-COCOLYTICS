<script setup>
import { computed, onMounted, ref } from 'vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { acceptStaff, fetchClients } from '../../services/api';

const users = ref([]);
const loading = ref(true);
const feedback = ref('');
const showAcceptConfirm = ref(false);
const targetUser = ref(null);

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

function requestAcceptStaff(user) {
  targetUser.value = user;
  showAcceptConfirm.value = true;
}

function cancelAcceptStaff() {
  showAcceptConfirm.value = false;
  targetUser.value = null;
}

async function confirmAcceptStaff() {
  if (!targetUser.value) return;
  const selectedId = targetUser.value.id;
  cancelAcceptStaff();
  await onAcceptStaff(selectedId);
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

    <div class="table-wrap">
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
            <td colspan="5">Loading staff applications...</td>
          </tr>
          <tr v-for="user in pendingStaff" :key="user.id">
            <td>{{ user.fullName }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.status }}</td>
            <td>{{ user.staffReason || '-' }}</td>
            <td>
              <button @click="requestAcceptStaff(user)">Accept as Staff</button>
            </td>
          </tr>
          <tr v-if="!loading && pendingStaff.length === 0">
            <td colspan="5">No pending staff applications.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmationModal
      :visible="showAcceptConfirm"
      title="Confirm Staff Approval"
      :message="`Approve ${targetUser?.fullName || 'this user'} as staff?`"
      confirm-label="Yes, Accept"
      cancel-label="Cancel"
      @confirm="confirmAcceptStaff"
      @cancel="cancelAcceptStaff"
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

.table-wrap {
  margin-top: 1rem;
  border: 1px solid rgba(139, 211, 255, 0.24);
  border-radius: 12px;
  overflow: auto;
  background: rgba(9, 31, 48, 0.78);
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
