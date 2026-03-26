<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import {
  archiveClient,
  fetchClientDetails,
  fetchClients,
} from '../../services/api';
import { toMediaUrl } from '../../services/media';

const route = useRoute();
const router = useRouter();

const users = ref([]);
const loading = ref(true);
const feedback = ref('');
const showArchiveConfirm = ref(false);
const targetUser = ref(null);
const searchText = ref('');
const statusFilter = ref('all');
const detailsLoading = ref(false);
const selectedUser = ref(null);
const documents = ref([]);

const ADMIN_USERS_UPDATED_EVENT = 'cocolytics-admin-users-updated';

const selectedUserId = computed(() => {
  const parsed = Number(route.params.id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
});

const isDetailView = computed(() => Boolean(selectedUserId.value));

const detailCutUploads = computed(() => documents.value.filter((item) => item.paperType === 'to_cut'));
const detailTransportUploads = computed(() => documents.value.filter((item) => item.paperType === 'transport'));

const detailStatus = computed(() => {
  if (!selectedUser.value) return '';
  return selectedUser.value.isArchived ? 'archived' : selectedUser.value.status;
});

const filteredUsers = computed(() => {
  const statusValue = String(statusFilter.value || 'all').trim().toLowerCase();
  const keyword = String(searchText.value || '').trim().toLowerCase();

  return users.value.filter((user) => {
    const normalizedStatus = String(user.isArchived ? 'archived' : (user.status || '')).toLowerCase();
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

async function loadUserDetails(id) {
  detailsLoading.value = true;
  feedback.value = '';
  try {
    const data = await fetchClientDetails(id);
    selectedUser.value = data.user || null;
    documents.value = data.documents || [];
  } catch (error) {
    feedback.value = error.message;
    selectedUser.value = null;
    documents.value = [];
  } finally {
    detailsLoading.value = false;
  }
}

function requestArchiveClient(user) {
  targetUser.value = user;
  showArchiveConfirm.value = true;
}

function cancelArchiveClient() {
  showArchiveConfirm.value = false;
  targetUser.value = null;
}

async function confirmArchiveClient() {
  if (!targetUser.value) return;
  const selectedId = targetUser.value.id;
  cancelArchiveClient();

  try {
    await archiveClient(selectedId);
    await loadUsers();
    if (selectedUserId.value === selectedId) {
      await loadUserDetails(selectedId);
    }
    window.dispatchEvent(new CustomEvent(ADMIN_USERS_UPDATED_EVENT));
  } catch (error) {
    feedback.value = error.message;
  }
}

function openDetails(user) {
  router.push({ name: 'admin-manage-user-details', params: { id: String(user.id) } });
}

function backToList() {
  router.push({ name: 'admin-manage-users' });
}

function toStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return '-';
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toStatusClass(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'pending_client' || normalized === 'pending_staff') {
    return 'status-pending';
  }

  if (normalized === 'accepted_client') {
    return 'status-accepted';
  }

  if (normalized === 'trader') {
    return 'status-trader';
  }

  if (normalized === 'archived') {
    return 'status-archived';
  }

  return 'status-default';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

onMounted(async () => {
  await loadUsers();
  if (selectedUserId.value) {
    await loadUserDetails(selectedUserId.value);
  }
});

watch(selectedUserId, async (nextId, prevId) => {
  if (!nextId) {
    if (prevId) {
      selectedUser.value = null;
      documents.value = [];
    }
    return;
  }

  await loadUserDetails(nextId);
});
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Manage Users</p>
      <h2>{{ isDetailView ? 'User Details' : 'Client Accounts' }}</h2>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section v-if="!isDetailView">
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
        <option value="archived">Archived</option>
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
              <th>Created</th>
              <th>Staff Reason</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7">Loading users...</td>
            </tr>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.fullName }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.role }}</td>
              <td>
                <span
                  class="status-pill"
                  :class="toStatusClass(user.isArchived ? 'archived' : user.status)"
                >
                  {{ toStatusLabel(user.isArchived ? 'archived' : user.status) }}
                </span>
              </td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>{{ user.staffReason || '-' }}</td>
              <td>
                <div class="action-stack">
                  <button
                    class="action-btn view"
                    @click="openDetails(user)"
                  >
                    View Details
                  </button>
                  <button
                    v-if="!user.isArchived"
                    class="action-btn danger"
                    @click="requestArchiveClient(user)"
                  >
                    Archive User
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && filteredUsers.length === 0">
              <td colspan="7">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="details">
      <button type="button" class="back-btn" @click="backToList">Back to Users</button>

      <div v-if="detailsLoading" class="details-loading">Loading user details...</div>

      <template v-else-if="selectedUser">
        <article class="detail-card">
          <h3>Basic Information</h3>
          <div class="profile-preview">
            <img
              v-if="selectedUser.profileImagePath"
              :src="toMediaUrl(selectedUser.profileImagePath)"
              :alt="`${selectedUser.fullName || 'User'} profile image`"
              class="profile-image"
            />
            <div v-else class="profile-fallback">No Profile Image</div>
          </div>
          <dl class="detail-grid">
            <div><dt>Full Name</dt><dd>{{ selectedUser.fullName || '-' }}</dd></div>
            <div><dt>Email</dt><dd>{{ selectedUser.email || '-' }}</dd></div>
            <div><dt>Role</dt><dd>{{ selectedUser.role || '-' }}</dd></div>
            <div>
              <dt>Status</dt>
              <dd>
                <span class="status-pill" :class="toStatusClass(detailStatus)">
                  {{ toStatusLabel(detailStatus) }}
                </span>
              </dd>
            </div>
            <div><dt>Created</dt><dd>{{ formatDate(selectedUser.createdAt) }}</dd></div>
            <div><dt>Archived At</dt><dd>{{ formatDate(selectedUser.archivedAt) }}</dd></div>
            <div><dt>Profile Name</dt><dd>{{ selectedUser.profileName || '-' }}</dd></div>
            <div><dt>Contact Number</dt><dd>{{ selectedUser.contactNumber || '-' }}</dd></div>
            <div><dt>Business Address</dt><dd>{{ selectedUser.businessAddress || '-' }}</dd></div>
            <div><dt>Staff Reason</dt><dd>{{ selectedUser.staffReason || '-' }}</dd></div>
          </dl>
          <p class="description"><strong>Description:</strong> {{ selectedUser.profileDescription || '-' }}</p>
        </article>

        <article class="detail-card">
          <h3>To Cut Documents</h3>
          <div class="table-wrap narrow">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in detailCutUploads" :key="item.id">
                  <td>{{ item.title }}</td>
                  <td>{{ item.description || '-' }}</td>
                  <td>
                    <a :href="toMediaUrl(item.filePath)" target="_blank" rel="noopener noreferrer">
                      {{ item.originalFileName }}
                    </a>
                  </td>
                  <td>{{ toStatusLabel(item.status) }}</td>
                  <td>{{ formatDate(item.createdAt) }}</td>
                </tr>
                <tr v-if="detailCutUploads.length === 0">
                  <td colspan="5">No to cut documents.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="detail-card">
          <h3>Transport Documents</h3>
          <div class="table-wrap narrow">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in detailTransportUploads" :key="item.id">
                  <td>{{ item.title }}</td>
                  <td>{{ item.description || '-' }}</td>
                  <td>
                    <a :href="toMediaUrl(item.filePath)" target="_blank" rel="noopener noreferrer">
                      {{ item.originalFileName }}
                    </a>
                  </td>
                  <td>{{ toStatusLabel(item.status) }}</td>
                  <td>{{ formatDate(item.createdAt) }}</td>
                </tr>
                <tr v-if="detailTransportUploads.length === 0">
                  <td colspan="5">No transport documents.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </template>
    </section>

    <ConfirmationModal
      :visible="showArchiveConfirm"
      title="Confirm User Archive"
      :message="`Archive ${targetUser?.fullName || 'this user'}? They will no longer be able to login.`"
      confirm-label="Yes, Archive"
      cancel-label="Cancel"
      :danger="true"
      @confirm="confirmArchiveClient"
      @cancel="cancelArchiveClient"
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

.table-wrap.narrow {
  margin-top: 0.6rem;
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
  cursor: pointer;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.16rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
}

.status-pending {
  color: #ffe7b8;
  background: rgba(138, 94, 14, 0.35);
  border-color: rgba(255, 194, 107, 0.5);
}

.status-accepted {
  color: #c8ffe5;
  background: rgba(16, 109, 66, 0.33);
  border-color: rgba(122, 241, 186, 0.45);
}

.status-trader {
  color: #d8ebff;
  background: rgba(38, 95, 160, 0.35);
  border-color: rgba(146, 198, 255, 0.48);
}

.status-archived {
  color: #ffd2d8;
  background: rgba(123, 38, 52, 0.36);
  border-color: rgba(255, 157, 175, 0.45);
}

.status-default {
  color: #dceeff;
  background: rgba(65, 105, 139, 0.3);
  border-color: rgba(152, 201, 240, 0.35);
}

.action-stack {
  display: grid;
  gap: 0.4rem;
}

.action-btn.view {
  background: rgba(26, 81, 122, 0.86);
  border-color: rgba(128, 196, 255, 0.45);
}

.action-btn.danger {
  background: rgba(129, 44, 44, 0.85);
  border-color: rgba(255, 163, 163, 0.45);
}

.details {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.85rem;
}

.back-btn {
  width: fit-content;
  border: 1px solid rgba(141, 212, 255, 0.45);
  border-radius: 8px;
  background: rgba(15, 62, 90, 0.85);
  color: #e8f6ff;
  padding: 0.45rem 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.details-loading {
  color: #cce9ff;
}

.detail-card {
  border: 1px solid rgba(140, 209, 255, 0.28);
  border-radius: 12px;
  background: rgba(8, 31, 48, 0.82);
  padding: 0.85rem;
}

.detail-card h3 {
  margin: 0;
}

.profile-preview {
  margin-top: 0.75rem;
}

.profile-image {
  width: 108px;
  height: 108px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(145, 208, 255, 0.5);
  background: rgba(7, 27, 41, 0.8);
}

.profile-fallback {
  width: 108px;
  height: 108px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #afd9f8;
  border: 1px dashed rgba(145, 208, 255, 0.5);
  background: rgba(7, 27, 41, 0.55);
}

.detail-grid {
  margin: 0.75rem 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.65rem;
}

.detail-grid dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #98d7ff;
}

.detail-grid dd {
  margin: 0.18rem 0 0;
}

.description {
  margin: 0.8rem 0 0;
  color: #d8f0ff;
}

@media (max-width: 700px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
