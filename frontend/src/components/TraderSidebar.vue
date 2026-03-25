<script setup>
import { toMediaUrl } from '../services/media';

defineProps({
  userName: {
    type: String,
    default: '',
  },
  userEmail: {
    type: String,
    default: '',
  },
  profileImagePath: {
    type: String,
    default: '',
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
  lowStockCount: {
    type: Number,
    default: 0,
  },
  unreadMessagesCount: {
    type: Number,
    default: 0,
  },
  toAcceptCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['logout', 'close']);
</script>

<template>
  <aside :class="['sidebar', { open: isOpen }]">
    <button type="button" class="close-btn" aria-label="Close sidebar" @click="emit('close')">X</button>

    <div class="brand">
      <router-link to="/trader/profile" class="profile-link" @click="emit('close')">
        <img
          v-if="profileImagePath"
          class="profile-image"
          :src="toMediaUrl(profileImagePath)"
          alt="Trader profile"
        />
        <div v-else class="profile-image placeholder">{{ (userName || 'T').slice(0, 1).toUpperCase() }}</div>
      </router-link>
      <p class="kicker">Cocolytics</p>
      <h1>Trader Panel</h1>
      <p class="display-name">{{ userName }}</p>
      <p class="account">{{ userEmail }}</p>
    </div>

    <nav class="nav-links">
      <router-link to="/trader/dashboard" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h8V3H3zm10 8h8v-8h-8zM3 21h8v-6H3zm10-10h8V3h-8z"/></svg>
          <span>Dashboard</span>
        </span>
      </router-link>
      <router-link to="/trader/profile" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.2 0 4-1.8 4-4S14.2 4 12 4 8 5.8 8 8s1.8 4 4 4zm0 2c-3.3 0-6 2.2-6 5v1h12v-1c0-2.8-2.7-5-6-5z"/></svg>
          <span>Profile</span>
        </span>
      </router-link>
      <router-link to="/trader/documents" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5"/></svg>
          <span>Documents</span>
        </span>
      </router-link>
      <router-link to="/trader/marketplace" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16l-1.5 12.5A2 2 0 0 1 16.5 21h-9a2 2 0 0 1-2-1.5L4 7zm4-4h8l1 3H7l1-3z"/></svg>
          <span>Marketplace</span>
        </span>
      </router-link>
      <router-link to="/trader/manage-orders" class="inventory-link" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3zm2 4h14v10H5zm3 2v2h8v-2z"/></svg>
          <span>Manage Orders</span>
        </span>
        <span v-if="toAcceptCount > 0" class="low-stock-badge">{{ toAcceptCount }} to accept</span>
      </router-link>
      <router-link to="/trader/inventory" class="inventory-link" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v4H4zm0 6h7v10H4zm9 0h7v10h-7z"/></svg>
          <span>Inventory</span>
        </span>
        <span v-if="lowStockCount > 0" class="low-stock-badge">{{ lowStockCount }} low</span>
      </router-link>
      <router-link to="/trader/operations" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5-2.1-1.6zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
          <span>Operations</span>
        </span>
      </router-link>
      <router-link to="/trader/browse-products" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v3H3zm2 5h14v9H5zm2 2v2h4v-2z"/></svg>
          <span>Browse Products</span>
        </span>
      </router-link>
      <router-link to="/trader/messages" class="inventory-link" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v11H7l-3 3V4z"/></svg>
          <span>Messages</span>
        </span>
        <span v-if="unreadMessagesCount > 0" class="low-stock-badge">{{ unreadMessagesCount }}</span>
      </router-link>
    </nav>

    <button type="button" class="logout" @click="emit('logout')">Logout</button>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 30;
  box-shadow: 8px 0 20px rgba(0, 0, 0, 0.45);
  border-right: 1px solid rgba(111, 215, 177, 0.24);
  width: min(82vw, 300px);
  max-width: 100%;
  padding: 1rem;
  background: linear-gradient(165deg, rgba(8, 34, 46, 0.94), rgba(9, 48, 63, 0.92));
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100vh;
  transition: transform 0.22s ease;
}

.close-btn {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  border: 1px solid rgba(131, 236, 200, 0.45);
  border-radius: 8px;
  background: rgba(11, 53, 64, 0.88);
  color: #e7fff4;
  width: 30px;
  height: 28px;
  font-size: 0.78rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.sidebar:not(.open) {
  transform: translateX(-105%);
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
  color: #8ff4c8;
}

.profile-image {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(131, 236, 200, 0.45);
}

.profile-link {
  width: 64px;
  display: inline-flex;
  border-radius: 999px;
  text-decoration: none;
}

.profile-link:focus-visible {
  outline: 2px solid rgba(151, 243, 211, 0.82);
  outline-offset: 3px;
}

.profile-image.placeholder {
  display: grid;
  place-items: center;
  background: rgba(11, 53, 64, 0.88);
  color: #dbfff2;
  font-weight: 900;
}

.display-name {
  margin: 0.4rem 0 0;
  color: #dffff2;
  font-weight: 700;
}

h1 {
  margin: 0.42rem 0 0;
  font-size: 1.35rem;
  color: #edfff6;
}

.account {
  margin: 0.35rem 0 0;
  color: #c4f8e2;
  font-size: 0.8rem;
  word-break: break-all;
}

.nav-links {
  display: grid;
  gap: 0.45rem;
}

.nav-links a {
  text-decoration: none;
  color: #d7ffed;
  border: 1px solid rgba(121, 227, 191, 0.27);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  font-weight: 700;
  font-size: 0.86rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-main {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.nav-main svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.inventory-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.low-stock-badge {
  border: 1px solid rgba(255, 192, 134, 0.55);
  border-radius: 999px;
  background: rgba(173, 82, 18, 0.85);
  color: #fff2e1;
  font-size: 0.68rem;
  padding: 0.1rem 0.42rem;
  font-weight: 800;
}

.nav-links a.router-link-active {
  background: rgba(63, 174, 138, 0.24);
  border-color: rgba(131, 236, 200, 0.55);
}

.logout {
  margin-top: auto;
  border: 1px solid rgba(255, 144, 156, 0.45);
  border-radius: 10px;
  background: rgba(160, 33, 53, 0.9);
  color: #ffe9ec;
  padding: 0.6rem 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 820px) {
  .sidebar {
    width: min(86vw, 300px);
  }
}
</style>
