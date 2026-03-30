<script setup>
defineProps({
  userName: {
    type: String,
    default: '',
  },
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
      <h1>Client Hub</h1>
      <p class="display-name">{{ userName }}</p>
      <p class="account">{{ userEmail }}</p>
    </div>

    <nav class="nav-links">
      <router-link to="/client/dashboard" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h8V3H3zm10 8h8v-8h-8zM3 21h8v-6H3zm10-10h8V3h-8z"/></svg>
          <span>Dashboard</span>
        </span>
      </router-link>
      <router-link to="/client/messages" @click="emit('close')">
        <span class="nav-main">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-5 4V7a2 2 0 0 1 2-2zm2 4v2h12V9zm0 4v2h8v-2z"/></svg>
          <span>Messages</span>
        </span>
      </router-link>
    </nav>

    <button type="button" class="logout" @click="emit('logout')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7v-2h7V5h-7V3zm1.7 13.3L9.4 14H15v-4H9.4l2.3-2.3L10.3 6 5 11.3 10.3 16.6l1.4-1.3z"/></svg>
      <span>Logout</span>
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 30;
  box-shadow: 8px 0 20px rgba(0, 0, 0, 0.45);
  border-right: 1px solid rgba(122, 228, 255, 0.24);
  width: min(82vw, 300px);
  max-width: 100%;
  padding: 1rem;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1.25rem);
  background: linear-gradient(165deg, rgba(7, 39, 48, 0.95), rgba(11, 60, 70, 0.92));
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
  transition: transform 0.22s ease;
}

.close-btn {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  border: 1px solid rgba(142, 224, 247, 0.45);
  border-radius: 8px;
  background: rgba(17, 61, 72, 0.88);
  color: #e9fcff;
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
  color: #8ce7ff;
}

h1 {
  margin: 0.42rem 0 0;
  font-size: 1.35rem;
  color: #f1feff;
}

.display-name {
  margin: 0.42rem 0 0;
  color: #d8fdff;
  font-weight: 700;
}

.account {
  margin: 0.35rem 0 0;
  color: #b7ebf3;
  font-size: 0.8rem;
  word-break: break-all;
}

.nav-links {
  display: grid;
  gap: 0.45rem;
}

.nav-links a {
  text-decoration: none;
  color: #ddf9ff;
  border: 1px solid rgba(132, 222, 248, 0.27);
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

.nav-links a.router-link-active {
  background: rgba(70, 187, 214, 0.24);
  border-color: rgba(143, 229, 255, 0.55);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.logout svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

@media (max-width: 820px) {
  .sidebar {
    width: min(86vw, 300px);
  }
}
</style>
