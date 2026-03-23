<script setup>
defineProps({
  userEmail: {
    type: String,
    default: '',
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
      <router-link to="/admin/dashboard" @click="emit('close')">Dashboard</router-link>
      <router-link to="/admin/manage-users" @click="emit('close')">Manage Users</router-link>
      <router-link to="/admin/staff-applications" @click="emit('close')">Staff Applications</router-link>
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
