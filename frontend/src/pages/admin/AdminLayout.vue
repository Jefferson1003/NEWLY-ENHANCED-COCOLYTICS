<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AdminSidebar from '../../components/AdminSidebar.vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { fetchClients } from '../../services/api';
import { clearSession, getUser } from '../../services/session';

const router = useRouter();
const user = getUser();
const sidebarOpen = ref(false);
const showLogoutConfirm = ref(false);
const pendingClientCount = ref(0);

const ADMIN_USERS_UPDATED_EVENT = 'cocolytics-admin-users-updated';

async function loadPendingClientCount() {
  try {
    const data = await fetchClients();
    const clients = data.clients || [];
    pendingClientCount.value = clients.filter((item) => item.status === 'pending_client' && !item.isArchived).length;
  } catch {
    pendingClientCount.value = 0;
  }
}

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

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebar() {
  sidebarOpen.value = false;
}

onMounted(() => {
  loadPendingClientCount();
  window.addEventListener(ADMIN_USERS_UPDATED_EVENT, loadPendingClientCount);
});

onUnmounted(() => {
  window.removeEventListener(ADMIN_USERS_UPDATED_EVENT, loadPendingClientCount);
});
</script>

<template>
  <section class="admin-layout">
    <AdminSidebar
      :user-email="user?.email || ''"
      :pending-client-count="pendingClientCount"
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

    <main class="content">
      <router-view />
    </main>

    <ConfirmationModal
      :visible="showLogoutConfirm"
      title="Confirm Logout"
      message="Are you sure you want to logout from admin?"
      confirm-label="Yes, Logout"
      cancel-label="Cancel"
      :danger="true"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    />
  </section>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #081923;
  color: #ecf7ff;
  position: relative;
  overflow: hidden;
}

.content {
  padding: 1rem;
  padding-top: 3.2rem;
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
  border: 1px solid rgba(141, 212, 255, 0.46);
  border-radius: 8px;
  background: rgba(13, 44, 66, 0.95);
  color: #e7f3ff;
  width: 38px;
  height: 34px;
  padding: 0.35rem;
}

.toggle span {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: #e7f3ff;
}

.overlay {
  display: block;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 25;
}

@media (max-width: 820px) {
  .content {
    padding-top: 3.2rem;
  }
}
</style>
