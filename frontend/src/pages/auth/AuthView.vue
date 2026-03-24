<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login, register } from '../../services/api';
import { clearVisitTraderIntent, getVisitTraderIntent, saveSession } from '../../services/session';

const router = useRouter();
const mode = ref('login');
const fullName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const staffReason = ref('');
const showPassword = ref(false);
const loading = ref(false);
const feedback = ref('');
const isError = ref(false);

function passwordIsStrong(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

function setMode(nextMode) {
  mode.value = nextMode;
  feedback.value = '';
  isError.value = false;

  if (nextMode === 'login') {
    confirmPassword.value = '';
    staffReason.value = '';
  }
}

function routeAfterLogin(user) {
  const traderIntentId = getVisitTraderIntent();

  if (traderIntentId && (user.role === 'client' || user.role === 'trader')) {
    clearVisitTraderIntent();
    return router.push({ name: 'trader-visit-detail', params: { id: String(traderIntentId) } });
  }

  if (traderIntentId) {
    clearVisitTraderIntent();
  }

  if (user.role === 'admin') return router.push('/admin');
  if (user.role === 'trader' || user.status === 'trader') return router.push('/trader/dashboard');
  return router.push('/client');
}

async function submitForm() {
  loading.value = true;
  feedback.value = '';
  isError.value = false;

  try {
    if (mode.value === 'register') {
      if (!String(staffReason.value || '').trim()) {
        isError.value = true;
        feedback.value = 'Please provide your reason for becoming a staff.';
        loading.value = false;
        return;
      }

      if (!passwordIsStrong(password.value)) {
        isError.value = true;
        feedback.value = 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
        loading.value = false;
        return;
      }

      if (password.value !== confirmPassword.value) {
        isError.value = true;
        feedback.value = 'Password and confirm password do not match.';
        loading.value = false;
        return;
      }

      await register({
        fullName: fullName.value,
        email: email.value,
        password: password.value,
        staffReason: staffReason.value,
      });

      feedback.value = 'Register application sent successfully, please wait for the admin approval.';
      setMode('login');
      password.value = '';
      confirmPassword.value = '';
      staffReason.value = '';
      loading.value = false;
      return;
    }

    const result = await login({
      email: email.value,
      password: password.value,
    });

    saveSession(result.token, result.user);
    routeAfterLogin(result.user);
  } catch (error) {
    isError.value = true;
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-layout">
    <div class="auth-card">
      <p class="kicker">Cocolytics Access</p>
      <h1>{{ mode === 'login' ? 'Login to your account' : 'Create your account' }}</h1>
      <p class="subtitle">Mobile-first onboarding for clients, staff, and admin users.</p>

      <div class="tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="setMode('login')">Login</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="setMode('register')">Register</button>
      </div>

      <form class="auth-form" @submit.prevent="submitForm">
        <label v-if="mode === 'register'">
          <span>Full Name</span>
          <input v-model="fullName" type="text" placeholder="Juan Dela Cruz" required />
        </label>
        <label>
          <span>Email</span>
          <input v-model="email" type="email" placeholder="admin@gmail.com" required />
        </label>
        <label>
          <span>Password</span>
          <input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Enter password" required />
        </label>

        <p v-if="mode === 'register'" class="password-hint">
          Create a password with at least 8 characters, uppercase, lowercase, and a number.
        </p>

        <label v-if="mode === 'register'">
          <span>Confirm Password</span>
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Re-enter password"
            required
          />
        </label>

        <label v-if="mode === 'register'">
          <span>Why do you want to become a staff?</span>
          <textarea
            v-model="staffReason"
            rows="3"
            placeholder="Tell us why you want to become a staff member"
            required
          ></textarea>
        </label>

        <label class="show-password">
          <input v-model="showPassword" type="checkbox" />
          <span>Show password</span>
        </label>

        <button class="submit" type="submit" :disabled="loading">
          {{ loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register' }}
        </button>
      </form>

      <p v-if="feedback" :class="['feedback', { error: isError }]">{{ feedback }}</p>

      <button class="back-home" type="button" @click="router.push('/')">Back to Home</button>
    </div>
  </section>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  padding: 1rem;
  display: grid;
  place-items: center;
}

.auth-card {
  width: min(100%, 460px);
  border-radius: 22px;
  border: 1px solid rgba(95, 213, 176, 0.35);
  background: linear-gradient(160deg, rgba(9, 36, 47, 0.9), rgba(11, 57, 72, 0.76));
  padding: 1rem;
  color: #e8fff4;
}

.kicker {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #90efc7;
}

h1 {
  margin: 0.5rem 0 0;
  font-size: 1.5rem;
}

.subtitle {
  margin: 0.45rem 0 0;
  color: #c3f6df;
  font-size: 0.9rem;
}

.tabs {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tabs button,
.submit,
.back-home {
  border: 1px solid rgba(117, 227, 189, 0.4);
  border-radius: 10px;
  background: rgba(13, 47, 59, 0.75);
  color: #e7fff5;
  font-weight: 700;
  font-size: 0.86rem;
  padding: 0.62rem 0.72rem;
}

.tabs button.active {
  background: rgba(75, 192, 154, 0.28);
}

.auth-form {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.65rem;
}

label {
  display: grid;
  gap: 0.3rem;
}

label span {
  font-size: 0.78rem;
  color: #c5f7e2;
}

.password-hint {
  margin: 0;
  color: #ff9aa8;
  font-size: 0.76rem;
  line-height: 1.3;
}

.show-password {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.show-password input[type='checkbox'] {
  width: 0.95rem;
  height: 0.95rem;
  accent-color: #7be6bc;
}

.show-password span {
  font-size: 0.78rem;
  color: #d2ffe8;
}

input {
  border: 1px solid rgba(109, 218, 181, 0.35);
  border-radius: 10px;
  background: rgba(7, 25, 33, 0.88);
  color: #eefff8;
  padding: 0.62rem 0.7rem;
  font-size: 0.85rem;
}

textarea {
  border: 1px solid rgba(109, 218, 181, 0.35);
  border-radius: 10px;
  background: rgba(7, 25, 33, 0.88);
  color: #eefff8;
  padding: 0.62rem 0.7rem;
  font-size: 0.85rem;
  font: inherit;
  resize: vertical;
}

.submit {
  margin-top: 0.2rem;
  background: linear-gradient(135deg, #9ff9cf, #46d2a6);
  color: #063028;
}

.submit:disabled {
  opacity: 0.7;
}

.feedback {
  margin: 0.8rem 0 0;
  color: #8ff1c7;
  font-size: 0.82rem;
}

.feedback.error {
  color: #ffb7c0;
}

.back-home {
  margin-top: 0.75rem;
  width: 100%;
  background: transparent;
}

@media (min-width: 900px) {
  .auth-card {
    width: min(100%, 520px);
    padding: 1.2rem;
  }
}
</style>
