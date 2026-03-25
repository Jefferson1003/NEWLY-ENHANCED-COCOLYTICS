<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import TraderSidebar from '../../components/TraderSidebar.vue';
import { fetchMe, fetchTraderMessageContacts, fetchTraderProducts } from '../../services/api';
import { clearSession, getUser, SESSION_UPDATED_EVENT } from '../../services/session';

const router = useRouter();
const profile = ref(null);
const feedback = ref('');
const sidebarOpen = ref(false);
const showLogoutConfirm = ref(false);
const lowStockCount = ref(0);
const unreadMessagesCount = ref(0);

const INVENTORY_UPDATED_EVENT = 'cocolytics-inventory-updated';
const MESSAGE_UPDATED_EVENT = 'cocolytics-messages-updated';

function syncProfileFromSession() {
  const user = getUser();
  if (user) {
    profile.value = user;
  }
}

async function loadProfile() {
  try {
    const data = await fetchMe();
    profile.value = data.user;
    if (data.user.role !== 'trader') {
      router.push('/client');
    }
  } catch (error) {
    feedback.value = error.message;
  }
}

async function loadLowStockCount() {
  try {
    const data = await fetchTraderProducts();
    const products = data.products || [];
    lowStockCount.value = products.filter((product) => Number(product.stockQuantity || 0) < 20).length;
  } catch {
    lowStockCount.value = 0;
  }
}

async function loadUnreadMessagesCount() {
  try {
    const data = await fetchTraderMessageContacts();
    const contacts = data.contacts || [];
    unreadMessagesCount.value = contacts.reduce(
      (total, contact) => total + Number(contact.unreadCount || 0),
      0
    );
  } catch {
    unreadMessagesCount.value = 0;
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
  syncProfileFromSession();
  loadProfile();
  loadLowStockCount();
  loadUnreadMessagesCount();

  window.addEventListener(SESSION_UPDATED_EVENT, syncProfileFromSession);
  window.addEventListener(INVENTORY_UPDATED_EVENT, loadLowStockCount);
  window.addEventListener(MESSAGE_UPDATED_EVENT, loadUnreadMessagesCount);
});

onUnmounted(() => {
  window.removeEventListener(SESSION_UPDATED_EVENT, syncProfileFromSession);
  window.removeEventListener(INVENTORY_UPDATED_EVENT, loadLowStockCount);
  window.removeEventListener(MESSAGE_UPDATED_EVENT, loadUnreadMessagesCount);
});
</script>

<template>
  <section class="trader-layout">
    <TraderSidebar
      :user-name="profile?.profileName || profile?.fullName || ''"
      :user-email="profile?.email || ''"
      :profile-image-path="profile?.profileImagePath || ''"
      :low-stock-count="lowStockCount"
      :unread-messages-count="unreadMessagesCount"
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

    <main class="trader-page">
      <p v-if="feedback" class="feedback">{{ feedback }}</p>
      <router-view />
    </main>

    <ConfirmationModal
      :visible="showLogoutConfirm"
      title="Confirm Logout"
      message="Are you sure you want to logout from trader panel?"
      confirm-label="Yes, Logout"
      cancel-label="Cancel"
      :danger="true"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    />
  </section>
</template>

<style scoped>
.trader-layout {
  min-height: 100vh;
  background: #071a22;
  position: relative;
  overflow: hidden;
}

.trader-page {
  padding: 1rem;
  padding-top: 3.2rem;
  color: #effff7;
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
  border: 1px solid rgba(131, 236, 200, 0.46);
  border-radius: 8px;
  background: rgba(12, 51, 61, 0.95);
  color: #e7fff4;
  width: 38px;
  height: 34px;
  padding: 0.35rem;
}

.toggle span {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: #e7fff4;
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
  .trader-page {
    padding-top: 3.2rem;
  }
}
</style>
