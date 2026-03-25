<script setup>
defineProps({
  userEmail: {
    type: String,
    default: '',
  },
  pendingClientCount: {
    type: Number,
    default: 0,
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['logout', 'close']);
</script>

<template>
  <aside :class="['sidebar', { open: isOpen }]">
    <button type="button" class="close-btn" aria-label="Close sidebar" @click="emit('close')">X</button>

    <div class="brand">
      <p class="kicker">Cocolytics</p>
      <h1>Admin Console</h1>
      <p class="account">{{ userEmail }}</p>
    </div>

    <nav class="nav-links">
      <router-link to="/admin/dashboard" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h8V3H3zm10 8h8v-8h-8zM3 21h8v-6H3zm10-10h8V3h-8z"/></svg>
          <span>Dashboard</span>
        </span>
      </router-link>
      <router-link to="/admin/manage-users" class="pending-link" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zM8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.7 0-1.1.1 1.2.8 2.1 1.9 2.1 3.4V19h7v-2.5c0-2.3-4.7-3.5-7-3.5z"/></svg>
          <span>Manage Users</span>
        </span>
        <span v-if="pendingClientCount > 0" class="pending-badge">{{ pendingClientCount }} pending</span>
      </router-link>
      <router-link to="/admin/staff-applications" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.2 0 4-1.8 4-4S14.2 4 12 4 8 5.8 8 8s1.8 4 4 4zm0 2c-3.3 0-6 2.2-6 5v1h12v-1c0-2.8-2.7-5-6-5z"/></svg>
          <span>Staff Applications</span>
        </span>
      </router-link>
      <router-link to="/admin/paper-approvals" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5"/></svg>
          <span>Paper Approvals</span>
        </span>
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
  border-right: 1px solid rgba(130, 203, 255, 0.22);
  width: min(82vw, 300px);
  max-width: 100%;
  padding: 1rem;
  background: linear-gradient(165deg, rgba(9, 33, 49, 0.94), rgba(9, 40, 58, 0.92));
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
  border: 1px solid rgba(141, 212, 255, 0.45);
  border-radius: 8px;
  background: rgba(14, 48, 71, 0.88);
  color: #e7f3ff;
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
  color: #90d7ff;
}

h1 {
  margin: 0.42rem 0 0;
  font-size: 1.35rem;
  color: #ecf7ff;
}

.account {
  margin: 0.35rem 0 0;
  color: #b5daf3;
  font-size: 0.8rem;
  word-break: break-all;
}

.nav-links {
  display: grid;
  gap: 0.45rem;
}

.nav-links a {
  text-decoration: none;
  color: #d4ebfc;
  border: 1px solid rgba(131, 204, 255, 0.27);
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

.pending-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.pending-badge {
  border: 1px solid rgba(255, 192, 134, 0.55);
  border-radius: 999px;
  background: rgba(173, 82, 18, 0.85);
  color: #fff2e1;
  font-size: 0.68rem;
  padding: 0.1rem 0.42rem;
  font-weight: 800;
}

.nav-links a.router-link-active {
  background: rgba(65, 148, 209, 0.24);
  border-color: rgba(141, 212, 255, 0.55);
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
