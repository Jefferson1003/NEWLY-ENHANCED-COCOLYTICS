<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { fetchAdminPaperUploads, fetchClients } from '../../services/api';

const users = ref([]);
const uploads = ref([]);
const loading = ref(false);
const feedback = ref('');

const ADMIN_USERS_UPDATED_EVENT = 'cocolytics-admin-users-updated';

const activeUsers = computed(() => users.value.filter((user) => !user.isArchived));
const archivedUsers = computed(() => users.value.filter((user) => user.isArchived));

const totalUsers = computed(() => users.value.length);
const activeUserCount = computed(() => activeUsers.value.length);
const archivedUserCount = computed(() => archivedUsers.value.length);

const pendingClients = computed(() => activeUsers.value.filter((user) => user.status === 'pending_client').length);
const acceptedClients = computed(() => activeUsers.value.filter((user) => user.status === 'accepted_client').length);
const traders = computed(() => activeUsers.value.filter((user) => user.role === 'trader').length);
const verifiedUsers = computed(() => activeUsers.value.filter((user) => user.isEmailVerified).length);

const pendingPapers = computed(() => uploads.value.filter((upload) => upload.status === 'pending').length);
const approvedPapers = computed(() => uploads.value.filter((upload) => upload.status === 'approved').length);
const rejectedPapers = computed(() => uploads.value.filter((upload) => upload.status === 'rejected').length);

const toCutPapers = computed(() => uploads.value.filter((upload) => upload.paperType === 'to_cut').length);
const transportPapers = computed(() => uploads.value.filter((upload) => upload.paperType === 'transport').length);

const recentRegistrations = computed(() => {
  return [...users.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
});

const recentPendingPapers = computed(() => {
  return uploads.value
    .filter((upload) => upload.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
});

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function toLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || '-';
}

async function loadDashboard() {
  loading.value = true;
  feedback.value = '';

  try {
    const [usersData, uploadsData] = await Promise.all([
      fetchClients(),
      fetchAdminPaperUploads(),
    ]);

    users.value = usersData.clients || [];
    uploads.value = uploadsData.uploads || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadDashboard();
  window.addEventListener(ADMIN_USERS_UPDATED_EVENT, loadDashboard);
});

onUnmounted(() => {
  window.removeEventListener(ADMIN_USERS_UPDATED_EVENT, loadDashboard);
});
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Admin Dashboard</p>
      <h1>Platform Overview</h1>
      <p class="subtitle">Accurate live metrics for users, client applications, and paper approvals.</p>
    </header>

    <p v-if="loading" class="muted">Loading admin analytics...</p>

    <section v-else class="stats-grid">
      <article class="stat-card">
        <p class="stat-label">Total Users</p>
        <p class="stat-value">{{ totalUsers }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Active Users</p>
        <p class="stat-value">{{ activeUserCount }}</p>
      </article>

      <article class="stat-card" :class="{ warning: archivedUserCount > 0 }">
        <p class="stat-label">Archived Users</p>
        <p class="stat-value">{{ archivedUserCount }}</p>
      </article>

      <article class="stat-card" :class="{ warning: pendingClients > 0 }">
        <p class="stat-label">Pending Clients</p>
        <p class="stat-value">{{ pendingClients }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Accepted Clients</p>
        <p class="stat-value">{{ acceptedClients }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Active Traders</p>
        <p class="stat-value">{{ traders }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Verified Users</p>
        <p class="stat-value">{{ verifiedUsers }}</p>
      </article>

      <article class="stat-card" :class="{ warning: pendingPapers > 0 }">
        <p class="stat-label">Pending Paper Reviews</p>
        <p class="stat-value">{{ pendingPapers }}</p>
      </article>
    </section>

    <article v-if="!loading" class="panel">
      <header class="panel-head">
        <h2>Paper Upload Analytics</h2>
        <span class="chip">{{ uploads.length }} total</span>
      </header>

      <ul class="status-list">
        <li>
          <span>Approved</span>
          <strong>{{ approvedPapers }}</strong>
        </li>
        <li>
          <span>Rejected</span>
          <strong>{{ rejectedPapers }}</strong>
        </li>
        <li>
          <span>To Cut Papers</span>
          <strong>{{ toCutPapers }}</strong>
        </li>
        <li>
          <span>Transport Papers</span>
          <strong>{{ transportPapers }}</strong>
        </li>
      </ul>
    </article>

    <article v-if="!loading" class="panel">
      <header class="panel-head">
        <h2>Recent Registrations</h2>
        <span class="chip">Latest 6</span>
      </header>

      <p v-if="!recentRegistrations.length" class="muted-line">No users found.</p>
      <ul v-else class="status-list">
        <li v-for="user in recentRegistrations" :key="user.id">
          <span>{{ user.fullName }} • {{ toLabel(user.isArchived ? 'archived' : user.status) }}</span>
          <strong>{{ formatDate(user.createdAt) }}</strong>
        </li>
      </ul>
    </article>

    <article v-if="!loading" class="panel">
      <header class="panel-head">
        <h2>Pending Paper Queue</h2>
        <span class="chip">Needs review</span>
      </header>

      <p v-if="!recentPendingPapers.length" class="muted-line">No pending paper uploads.</p>
      <ul v-else class="status-list">
        <li v-for="upload in recentPendingPapers" :key="upload.id">
          <span>
            {{ upload.traderName || 'Unknown trader' }} • {{ toLabel(upload.paperType) }} • {{ upload.title }}
          </span>
          <strong>{{ formatDate(upload.createdAt) }}</strong>
        </li>
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

.subtitle {
  margin: 0.4rem 0 0;
  color: #c2f7e0;
}

.muted {
  margin-top: 1rem;
  color: #c8fce6;
}

.stats-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.68rem;
}

.stat-card {
  border: 1px solid rgba(113, 215, 177, 0.34);
  border-radius: 14px;
  padding: 0.74rem 0.72rem;
  background: linear-gradient(150deg, rgba(7, 40, 53, 0.88), rgba(10, 61, 76, 0.7));
  min-height: 88px;
}

.stat-card.warning {
  border-color: rgba(255, 195, 136, 0.55);
  background: linear-gradient(150deg, rgba(57, 35, 16, 0.82), rgba(90, 55, 23, 0.72));
}

.stat-label {
  margin: 0;
  color: #c0f7de;
  font-size: 0.8rem;
}

.stat-value {
  margin: 0.36rem 0 0;
  font-size: 1.45rem;
  font-weight: 800;
}

.panel {
  margin-top: 0.95rem;
  border: 1px solid rgba(112, 216, 178, 0.28);
  border-radius: 14px;
  padding: 0.8rem;
  background: rgba(8, 41, 54, 0.7);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

h2 {
  margin: 0;
  font-size: 1rem;
}

.chip {
  border: 1px solid rgba(148, 234, 201, 0.4);
  border-radius: 999px;
  padding: 0.13rem 0.52rem;
  font-size: 0.72rem;
  color: #d7ffef;
  background: rgba(15, 97, 73, 0.45);
}

.status-list {
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.48rem;
}

.status-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid rgba(141, 231, 195, 0.18);
  border-radius: 10px;
  padding: 0.55rem 0.62rem;
}

.status-list span {
  color: #d6fff0;
  font-size: 0.83rem;
}

.status-list strong {
  color: #f3fff8;
  font-size: 0.8rem;
}

.muted-line {
  margin-top: 0.65rem;
  color: #c5f7e3;
  font-size: 0.82rem;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffd0d8;
}

@media (min-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
