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
      <h1>Trader Panel</h1>
      <p class="account">{{ userEmail }}</p>
    </div>

    <nav class="nav-links">
      <router-link to="/trader" @click="emit('close')">Dashboard</router-link>
      <a href="#snapshot" @click="emit('close')">Snapshot</a>
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
