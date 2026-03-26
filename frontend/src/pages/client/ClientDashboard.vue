<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ClientSidebar from '../../components/ClientSidebar.vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { fetchMe } from '../../services/api';
import { clearSession, saveSession, getToken } from '../../services/session';

const router = useRouter();
const profile = ref(null);
const feedback = ref('');
const sidebarOpen = ref(false);
const showLogoutConfirm = ref(false);
let pollTimer;

function logout() {
  clearSession();
  router.push('/auth');
}

function requestLogout() {
  showLogoutConfirm.value = true;
}

function cancelLogout() {
  showLogoutConfirm.value = false;
}

function confirmLogout() {
  showLogoutConfirm.value = false;
  logout();
}

async function loadProfile() {
  try {
    const data = await fetchMe();
    profile.value = data.user;
    saveSession(getToken(), data.user);

    if (data.user.role === 'trader' || data.user.status === 'trader') {
      router.push('/trader/dashboard');
    }
  } catch (error) {
    feedback.value = error.message;
  }
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebar() {
  sidebarOpen.value = false;
}

onMounted(async () => {
  await loadProfile();
  pollTimer = setInterval(loadProfile, 8000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});
</script>

<template>
  <section class="client-layout">
    <ClientSidebar
      :user-name="profile?.fullName || 'Client'"
      :user-email="profile?.email || ''"
      :is-open="sidebarOpen"
      @logout="requestLogout"
      @close="closeSidebar"
    />

    <button
      v-if="!sidebarOpen"
      :class="['toggle', { open: sidebarOpen }]"
      type="button"
      aria-label="Toggle sidebar"
      @click="toggleSidebar"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div v-if="sidebarOpen" class="overlay" @click="closeSidebar"></div>

    <main class="client-page">
      <p v-if="feedback" class="feedback">{{ feedback }}</p>
      <router-view />
    </main>

    <ConfirmationModal
      :visible="showLogoutConfirm"
      title="Confirm Logout"
      message="Are you sure you want to logout?"
      confirm-label="Yes, Logout"
      cancel-label="Cancel"
      :danger="true"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    />
  </section>
</template>

<style scoped>
.client-layout {
  min-height: 100vh;
  background: #071c24;
  position: relative;
  overflow: hidden;
}

.client-page {
  padding: 1rem;
  padding-top: 3.2rem;
  color: #edfff6;
}

.toggle {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  position: fixed;
  top: 0.85rem;
  left: 0.85rem;
  z-index: 35;
  border: 1px solid rgba(151, 233, 255, 0.46);
  border-radius: 10px;
  background: rgba(13, 49, 60, 0.95);
  color: #e7fcff;
  width: 38px;
  height: 34px;
  padding: 0.35rem;
}

.toggle span {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: #e7fcff;
}

.feedback {
  margin: 0 0 0.8rem;
  color: #ffbfca;
}

.overlay {
  display: block;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 25;
}

@media (max-width: 820px) {
  .client-page {
    padding-top: 3.2rem;
  }
}
</style>
