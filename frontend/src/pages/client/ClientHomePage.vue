<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { acceptTraderRole, fetchMe } from '../../services/api';
import { getUser, getToken, saveSession } from '../../services/session';

const router = useRouter();
const profile = ref(null);
const feedback = ref('');
const loading = ref(true);
const showAcceptTraderConfirm = ref(false);
const acceptedTerms = ref(false);

const TERMS_KEY_PREFIX = 'cocolytics-client-accepted-terms';

let pollTimer;

const canUpgradeToTrader = computed(() => profile.value?.status === 'accepted_client');

function termsStorageKey() {
  const userId = Number(profile.value?.id || getUser()?.id || 0);
  return `${TERMS_KEY_PREFIX}:${userId || 'unknown'}`;
}

function syncTermsState() {
  acceptedTerms.value = localStorage.getItem(termsStorageKey()) === 'accepted';
}

function goToTermsPage() {
  router.push('/client/terms');
}

async function loadProfile() {
  try {
    const data = await fetchMe();
    profile.value = data.user;
    saveSession(getToken(), data.user);

    if (data.user.role === 'trader' || data.user.status === 'trader') {
      router.push('/trader/dashboard');
      return;
    }

    syncTermsState();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

function requestAcceptTrader() {
  feedback.value = '';

  if (!acceptedTerms.value) {
    feedback.value = 'Please read and accept the Terms and Conditions before becoming a trader.';
    return;
  }

  showAcceptTraderConfirm.value = true;
}

function cancelAcceptTrader() {
  showAcceptTraderConfirm.value = false;
}

async function confirmAcceptTrader() {
  showAcceptTraderConfirm.value = false;

  try {
    const result = await acceptTraderRole();
    feedback.value = result.message || 'Trader upgrade request accepted.';
    await loadProfile();
  } catch (error) {
    feedback.value = error.message;
  }
}

function statusText(status) {
  if (status === 'trader') return 'You are now a trader and can access the trader panel.';
  if (status === 'pending_client') return 'Your account is pending admin approval before upgrades are enabled.';
  if (status === 'accepted_client') return 'Your account is approved. You may now become a trader after accepting terms.';
  return 'Your account details are being prepared.';
}

onMounted(async () => {
  await loadProfile();
  pollTimer = setInterval(loadProfile, 8000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});
</script>

<template>
  <section class="client-home">
    <header class="hero">
      <p class="kicker">Client Dashboard</p>
      <h1>Welcome, {{ profile?.fullName || 'Client' }}</h1>
      <p class="subtitle">Track your account progress, read important information, and unlock trader access when ready.</p>
    </header>

    <section class="status-card" v-if="!loading">
      <div class="status-grid">
        <article>
          <p class="label">Email</p>
          <p class="value">{{ profile?.email || '-' }}</p>
        </article>
        <article>
          <p class="label">Current Status</p>
          <p class="value">{{ profile?.status || '-' }}</p>
        </article>
        <article>
          <p class="label">Role</p>
          <p class="value">{{ profile?.role || '-' }}</p>
        </article>
      </div>

      <p class="note">{{ statusText(profile?.status) }}</p>

      <div class="terms-state">
        <span class="pill" :class="{ accepted: acceptedTerms }">
          {{ acceptedTerms ? 'Terms accepted' : 'Terms not yet accepted' }}
        </span>
        <span class="terms-inline-note">Review terms and agreement before upgrading to trader.</span>
      </div>

      <button type="button" class="terms-btn" @click="goToTermsPage">Accept Terms and Conditions</button>

      <button
        v-if="canUpgradeToTrader"
        class="staff-btn"
        :disabled="!acceptedTerms"
        @click="requestAcceptTrader"
      >
        Accept as Trader
      </button>
    </section>

    <section class="info-grid">
      <article class="info-card">
        <h2>How It Works</h2>
        <p>Cocolytics lets clients monitor account status and transition into verified traders once approved.</p>
      </article>
      <article class="info-card">
        <h2>Before You Upgrade</h2>
        <p>Prepare your profile details, verify your contact data, and review the operational responsibilities in terms.</p>
      </article>
      <article class="info-card">
        <h2>After Upgrade</h2>
        <p>You will get access to marketplace tools, inventory management, order handling, and trader communications.</p>
      </article>
    </section>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <ConfirmationModal
      :visible="showAcceptTraderConfirm"
      title="Confirm Trader Upgrade"
      message="Do you accept the responsibilities and want to become a trader now?"
      confirm-label="Yes, Become Trader"
      cancel-label="Cancel"
      @confirm="confirmAcceptTrader"
      @cancel="cancelAcceptTrader"
    />
  </section>
</template>

<style scoped>
.client-home {
  display: grid;
  gap: 1rem;
}

.hero {
  border: 1px solid rgba(125, 231, 255, 0.28);
  border-radius: 18px;
  background: radial-gradient(circle at top right, rgba(56, 165, 191, 0.22), rgba(11, 48, 60, 0.85));
  padding: 1rem;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #99f2ff;
}

h1 {
  margin: 0.4rem 0 0;
  font-size: 1.45rem;
}

.subtitle {
  margin: 0.55rem 0 0;
  color: #cef9ff;
  max-width: 58ch;
}

.status-card {
  border: 1px solid rgba(129, 226, 243, 0.34);
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(8, 35, 45, 0.9), rgba(13, 69, 84, 0.72));
  padding: 1rem;
  display: grid;
  gap: 0.8rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.label {
  margin: 0;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9defff;
}

.value {
  margin: 0.3rem 0 0;
  color: #ecfeff;
  font-weight: 700;
  word-break: break-word;
}

.note {
  margin: 0;
  color: #d7fbff;
  font-size: 0.9rem;
}

.terms-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.pill {
  border: 1px solid rgba(255, 202, 132, 0.55);
  border-radius: 999px;
  background: rgba(151, 84, 25, 0.85);
  color: #fff3de;
  padding: 0.18rem 0.58rem;
  font-size: 0.75rem;
  font-weight: 800;
}

.pill.accepted {
  border-color: rgba(128, 242, 195, 0.56);
  background: rgba(24, 121, 88, 0.86);
  color: #e9fff6;
}

.terms-inline-note {
  color: #9beeff;
  font-weight: 700;
  font-size: 0.82rem;
}

.terms-btn,
.staff-btn {
  border: 1px solid rgba(132, 239, 200, 0.42);
  border-radius: 10px;
  color: #effff7;
  padding: 0.55rem 0.78rem;
  font-weight: 700;
  width: fit-content;
  cursor: pointer;
}

.terms-btn {
  background: rgba(20, 88, 112, 0.82);
}

.staff-btn {
  background: rgba(17, 107, 80, 0.82);
}

.staff-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.info-card {
  border: 1px solid rgba(127, 218, 234, 0.3);
  border-radius: 14px;
  background: rgba(7, 34, 43, 0.78);
  padding: 0.88rem;
}

.info-card h2 {
  margin: 0;
  font-size: 1rem;
  color: #e4fcff;
}

.info-card p {
  margin: 0.5rem 0 0;
  color: #c8f5fb;
  font-size: 0.9rem;
}

.feedback {
  margin: 0;
  color: #ffd0d8;
}

@media (max-width: 980px) {
  .status-grid,
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
