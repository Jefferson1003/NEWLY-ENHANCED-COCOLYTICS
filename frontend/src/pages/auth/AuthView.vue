<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  login,
  register,
  requestForgotPasswordOtp,
  resendVerifyEmailOtp,
  resetForgotPassword,
  verifyEmailOtp,
  verifyForgotPasswordOtp,
} from '../../services/api';
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

const verifyEmail = ref('');
const verifyOtp = ref('');

const forgotEmail = ref('');
const forgotOtp = ref('');
const resetToken = ref('');
const forgotNewPassword = ref('');
const forgotConfirmPassword = ref('');

function passwordIsStrong(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

function setFeedback(message, error = false) {
  feedback.value = message;
  isError.value = error;
}

function setMode(nextMode) {
  mode.value = nextMode;
  setFeedback('', false);
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

function openVerifyEmailScreen(prefillEmail = '') {
  verifyEmail.value = String(prefillEmail || email.value || verifyEmail.value || '').trim();
  verifyOtp.value = '';
  setMode('verify-email');
}

function openForgotPasswordScreen(prefillEmail = '') {
  forgotEmail.value = String(prefillEmail || email.value || '').trim();
  forgotOtp.value = '';
  resetToken.value = '';
  forgotNewPassword.value = '';
  forgotConfirmPassword.value = '';
  setMode('forgot-email');
}

async function submitLogin() {
  const result = await login({
    email: email.value,
    password: password.value,
  });

  saveSession(result.token, result.user);
  routeAfterLogin(result.user);
}

async function submitRegister() {
  if (!String(staffReason.value || '').trim()) {
    throw new Error('Please provide your reason for becoming a staff.');
  }

  if (!passwordIsStrong(password.value)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
  }

  if (password.value !== confirmPassword.value) {
    throw new Error('Password and confirm password do not match.');
  }

  const result = await register({
    fullName: fullName.value,
    email: email.value,
    password: password.value,
    staffReason: staffReason.value,
  });

  verifyEmail.value = result.email || email.value;
  verifyOtp.value = '';
  setMode('verify-email');
  setFeedback('Registration complete. Enter the OTP sent to your email to verify.', false);
}

async function submitVerifyEmailOtp() {
  const result = await verifyEmailOtp({
    email: verifyEmail.value,
    otp: verifyOtp.value,
  });

  saveSession(result.token, result.user);
  routeAfterLogin(result.user);
}

async function resendVerifyOtp() {
  loading.value = true;
  setFeedback('', false);
  try {
    await resendVerifyEmailOtp({ email: verifyEmail.value });
    setFeedback('A new verification OTP was sent to your email.', false);
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    loading.value = false;
  }
}

async function submitForgotEmail() {
  await requestForgotPasswordOtp({ email: forgotEmail.value });
  forgotOtp.value = '';
  setMode('forgot-otp');
  setFeedback('Enter the OTP sent to your email.', false);
}

async function submitForgotOtp() {
  const result = await verifyForgotPasswordOtp({
    email: forgotEmail.value,
    otp: forgotOtp.value,
  });

  resetToken.value = result.resetToken;
  forgotNewPassword.value = '';
  forgotConfirmPassword.value = '';
  setMode('forgot-reset');
  setFeedback('OTP verified. You can now create a new password.', false);
}

async function submitForgotResetPassword() {
  if (forgotNewPassword.value !== forgotConfirmPassword.value) {
    throw new Error('Password and confirm password do not match.');
  }

  if (!passwordIsStrong(forgotNewPassword.value)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
  }

  await resetForgotPassword({
    resetToken: resetToken.value,
    newPassword: forgotNewPassword.value,
    confirmPassword: forgotConfirmPassword.value,
  });

  setMode('login');
  password.value = '';
  confirmPassword.value = '';
  setFeedback('Password reset successful. You can now log in.', false);
}

async function submitForm() {
  loading.value = true;
  setFeedback('', false);

  try {
    if (mode.value === 'register') {
      await submitRegister();
      return;
    }

    if (mode.value === 'login') {
      await submitLogin();
      return;
    }

    if (mode.value === 'verify-email') {
      await submitVerifyEmailOtp();
      return;
    }

    if (mode.value === 'forgot-email') {
      await submitForgotEmail();
      return;
    }

    if (mode.value === 'forgot-otp') {
      await submitForgotOtp();
      return;
    }

    if (mode.value === 'forgot-reset') {
      await submitForgotResetPassword();
    }
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      verifyEmail.value = error.details?.email || email.value;
      verifyOtp.value = '';
      setMode('verify-email');
      setFeedback('Your account is not verified yet. Enter OTP or resend a new code.', true);
    } else {
      setFeedback(error.message, true);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-layout">
    <div class="auth-card">
      <p class="kicker">Cocolytics Access</p>
      <h1 v-if="mode === 'login'">Login to your account</h1>
      <h1 v-else-if="mode === 'register'">Create your account</h1>
      <h1 v-else-if="mode === 'verify-email'">Verify your email</h1>
      <h1 v-else-if="mode === 'forgot-email'">Forgot password</h1>
      <h1 v-else-if="mode === 'forgot-otp'">Verify reset OTP</h1>
      <h1 v-else>Create a new password</h1>
      <p class="subtitle">Step-by-step secure access with OTP verification.</p>

      <div v-if="mode === 'login' || mode === 'register'" class="tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="setMode('login')">Login</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="setMode('register')">Register</button>
      </div>

      <form class="auth-form" @submit.prevent="submitForm">
        <template v-if="mode === 'register'">
          <label>
            <span>Full Name</span>
            <input v-model="fullName" type="text" placeholder="Juan Dela Cruz" required />
          </label>
          <label>
            <span>Email</span>
            <input v-model="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5L19.5 21M9.9 9.9A3 3 0 0014.1 14.1M10.7 5.1A11 11 0 0112 5c5.7 0 9.6 5.1 10 6-.2.4-1.1 2-2.8 3.5M6.6 6.6C3.7 8.3 2.1 10.8 2 11c.4.9 4.3 6 10 6 1.4 0 2.8-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12c.4-.9 4.3-6 10-6s9.6 5.1 10 6c-.4.9-4.3 6-10 6S2.4 12.9 2 12z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </label>
          <label>
            <span>Confirm Password</span>
            <div class="password-field">
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Confirm password"
                required
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5L19.5 21M9.9 9.9A3 3 0 0014.1 14.1M10.7 5.1A11 11 0 0112 5c5.7 0 9.6 5.1 10 6-.2.4-1.1 2-2.8 3.5M6.6 6.6C3.7 8.3 2.1 10.8 2 11c.4.9 4.3 6 10 6 1.4 0 2.8-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12c.4-.9 4.3-6 10-6s9.6 5.1 10 6c-.4.9-4.3 6-10 6S2.4 12.9 2 12z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </label>
          <label>
            <span>Why do you want to become a staff?</span>
            <textarea
              v-model="staffReason"
              rows="3"
              placeholder="Tell us your reason"
              required
            ></textarea>
          </label>
        </template>

        <template v-else-if="mode === 'login'">
          <label>
            <span>Email</span>
            <input v-model="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5L19.5 21M9.9 9.9A3 3 0 0014.1 14.1M10.7 5.1A11 11 0 0112 5c5.7 0 9.6 5.1 10 6-.2.4-1.1 2-2.8 3.5M6.6 6.6C3.7 8.3 2.1 10.8 2 11c.4.9 4.3 6 10 6 1.4 0 2.8-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12c.4-.9 4.3-6 10-6s9.6 5.1 10 6c-.4.9-4.3 6-10 6S2.4 12.9 2 12z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </label>
        </template>

        <template v-else-if="mode === 'verify-email'">
          <label>
            <span>Email</span>
            <input v-model="verifyEmail" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>OTP (letters and numbers)</span>
            <input v-model="verifyOtp" type="text" maxlength="8" placeholder="e.g. AB12CD34" required />
          </label>
        </template>

        <template v-else-if="mode === 'forgot-email'">
          <label>
            <span>Enter your email</span>
            <input v-model="forgotEmail" type="email" placeholder="you@example.com" required />
          </label>
        </template>

        <template v-else-if="mode === 'forgot-otp'">
          <label>
            <span>Email</span>
            <input v-model="forgotEmail" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>OTP</span>
            <input v-model="forgotOtp" type="text" maxlength="8" placeholder="Enter OTP" required />
          </label>
        </template>

        <template v-else>
          <label>
            <span>New Password</span>
            <input
              v-model="forgotNewPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter new password"
              required
            />
          </label>
          <label>
            <span>Confirm Password</span>
            <input
              v-model="forgotConfirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Confirm new password"
              required
            />
          </label>
        </template>

        <button class="submit" type="submit" :disabled="loading">
          <span v-if="loading">Please wait...</span>
          <span v-else-if="mode === 'login'">Login</span>
          <span v-else-if="mode === 'register'">Register</span>
          <span v-else-if="mode === 'verify-email'">Verify Email OTP</span>
          <span v-else-if="mode === 'forgot-email'">Send OTP</span>
          <span v-else-if="mode === 'forgot-otp'">Verify OTP</span>
          <span v-else>Reset Password</span>
        </button>
      </form>

      <div class="actions" v-if="mode === 'login'">
        <button type="button" class="ghost" @click="openVerifyEmailScreen(email)">Verify Email</button>
        <button type="button" class="ghost" @click="openForgotPasswordScreen(email)">Forgot Password</button>
      </div>

      <div class="actions" v-else-if="mode === 'verify-email'">
        <button type="button" class="ghost" @click="resendVerifyOtp" :disabled="loading">Resend OTP</button>
        <button type="button" class="ghost" @click="setMode('login')">Back to Login</button>
      </div>

      <div class="actions" v-else-if="mode === 'forgot-email' || mode === 'forgot-otp' || mode === 'forgot-reset'">
        <button type="button" class="ghost" @click="openForgotPasswordScreen(forgotEmail)">Start Over</button>
        <button type="button" class="ghost" @click="setMode('login')">Back to Login</button>
      </div>

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
  width: min(100%, 520px);
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
.back-home,
.ghost {
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

input,
textarea {
  border: 1px solid rgba(109, 218, 181, 0.35);
  border-radius: 10px;
  background: rgba(7, 25, 33, 0.88);
  color: #eefff8;
  padding: 0.62rem 0.7rem;
  font-size: 0.85rem;
  width: 100%;
}

textarea {
  font: inherit;
  resize: vertical;
}

.password-field {
  position: relative;
}

.password-field input {
  padding-right: 2.5rem;
}

.password-toggle {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.8rem;
  height: 1.8rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #a4f4d3;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.password-toggle svg {
  width: 1.1rem;
  height: 1.1rem;
}

.password-toggle:hover {
  background: rgba(117, 227, 189, 0.14);
}

.password-toggle:focus-visible {
  outline: 2px solid rgba(151, 243, 204, 0.7);
  outline-offset: 1px;
}

.submit {
  margin-top: 0.2rem;
  background: linear-gradient(135deg, #9ff9cf, #46d2a6);
  color: #063028;
}

.actions {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.ghost {
  background: transparent;
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
</style>
