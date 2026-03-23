<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close'])
const mode = ref('login')
</script>

<template>
  <section class="auth-page">
    <div class="auth-top">
      <p class="auth-kicker">Welcome Back</p>
      <button type="button" class="back-btn" @click="emit('close')">Back</button>
    </div>

    <h2>Cocolytics Account</h2>
    <p class="auth-copy">Sign in to continue tracking your mobile dashboards, or create a new workspace account.</p>

    <div class="tabs" role="tablist" aria-label="Authentication mode">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: mode === 'login' }"
        role="tab"
        :aria-selected="mode === 'login'"
        @click="mode = 'login'"
      >
        Login
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: mode === 'register' }"
        role="tab"
        :aria-selected="mode === 'register'"
        @click="mode = 'register'"
      >
        Register
      </button>
    </div>

    <form v-if="mode === 'login'" class="auth-form" @submit.prevent>
      <label>
        <span>Email</span>
        <input type="email" placeholder="you@company.com" autocomplete="email" />
      </label>
      <label>
        <span>Password</span>
        <input type="password" placeholder="Enter your password" autocomplete="current-password" />
      </label>
      <button type="submit" class="submit-btn">🔐 Login</button>
    </form>

    <form v-else class="auth-form" @submit.prevent>
      <label>
        <span>Full Name</span>
        <input type="text" placeholder="Your full name" autocomplete="name" />
      </label>
      <label>
        <span>Email</span>
        <input type="email" placeholder="you@company.com" autocomplete="email" />
      </label>
      <label>
        <span>Password</span>
        <input type="password" placeholder="Create a password" autocomplete="new-password" />
      </label>
      <button type="submit" class="submit-btn">🧾 Create Account</button>
    </form>
  </section>
</template>

<style scoped>
.auth-page {
  width: min(100%, 460px);
  margin: 0 auto;
  border: 1px solid rgba(112, 214, 175, 0.35);
  border-radius: 20px;
  background: linear-gradient(165deg, rgba(10, 40, 51, 0.9), rgba(12, 52, 67, 0.66));
  padding: 1rem;
  color: #e9fff5;
  animation: authFade 0.32s ease;
}

.auth-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.auth-kicker {
  margin: 0;
  color: #95f2c8;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
  font-weight: 700;
}

.back-btn {
  border: 1px solid rgba(123, 225, 188, 0.4);
  background: rgba(13, 60, 73, 0.7);
  color: #dffff0;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

h2 {
  margin: 0.55rem 0 0;
  font-size: 1.35rem;
}

.auth-copy {
  margin: 0.45rem 0 0;
  color: #c3f7de;
  font-size: 0.88rem;
}

.tabs {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tab-btn {
  border: 1px solid rgba(126, 226, 191, 0.35);
  border-radius: 10px;
  background: rgba(12, 45, 57, 0.7);
  color: #d7fff0;
  font-size: 0.84rem;
  font-weight: 700;
  padding: 0.58rem 0.7rem;
  cursor: pointer;
}

.tab-btn.active {
  background: rgba(57, 186, 147, 0.22);
  border-color: rgba(126, 226, 191, 0.7);
}

.auth-form {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.68rem;
}

label {
  display: grid;
  gap: 0.35rem;
}

label span {
  font-size: 0.78rem;
  color: #c7f8e3;
  font-weight: 600;
}

input {
  width: 100%;
  border: 1px solid rgba(121, 220, 183, 0.35);
  border-radius: 10px;
  background: rgba(6, 27, 35, 0.85);
  color: #effff7;
  padding: 0.62rem 0.72rem;
  font-size: 0.84rem;
}

input::placeholder {
  color: #93cfb6;
}

.submit-btn {
  margin-top: 0.25rem;
  border: 1px solid rgba(131, 239, 200, 0.45);
  border-radius: 10px;
  padding: 0.68rem 0.82rem;
  background: linear-gradient(135deg, #93f5c9, #3fca9f);
  color: #093029;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

@keyframes authFade {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 720px) {
  .auth-page {
    width: min(100%, 960px);
    padding: 1.2rem;
  }
}
</style>
