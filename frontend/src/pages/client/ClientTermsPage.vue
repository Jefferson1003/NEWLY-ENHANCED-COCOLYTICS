<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getUser } from '../../services/session';

const router = useRouter();
const accepted = ref(false);

const TERMS_KEY_PREFIX = 'cocolytics-client-accepted-terms';

const currentUserId = computed(() => Number(getUser()?.id || 0));

function termsStorageKey() {
  return `${TERMS_KEY_PREFIX}:${currentUserId.value || 'unknown'}`;
}

function loadTermsState() {
  accepted.value = localStorage.getItem(termsStorageKey()) === 'accepted';
}

function onToggleAcceptance(event) {
  accepted.value = Boolean(event?.target?.checked);
  localStorage.setItem(termsStorageKey(), accepted.value ? 'accepted' : 'pending');
}

function goBackToDashboard() {
  router.push('/client/dashboard');
}

onMounted(() => {
  loadTermsState();
});
</script>

<template>
  <section class="terms-page">
    <header class="hero">
      <p class="kicker">Policy</p>
      <h1>Terms and Conditions</h1>
      <p class="subtitle">Please review and accept before requesting trader access.</p>
    </header>

    <article class="terms-card">
      <h2>Client and Trader Responsibilities</h2>
      <ul>
        <li>Provide accurate profile and contact information at all times.</li>
        <li>Use the platform only for lawful cocofiber marketplace transactions.</li>
        <li>Respect delivery timelines, order commitments, and communication etiquette.</li>
        <li>Do not submit misleading pricing, product details, or transaction records.</li>
        <li>Understand that repeated policy violations may suspend account privileges.</li>
      </ul>

      <h2>Data and Security</h2>
      <ul>
        <li>Keep your account credentials private and avoid sharing your login details.</li>
        <li>Report suspicious activity immediately through official support channels.</li>
        <li>Allow the system to store operational data for account verification and transaction audits.</li>
      </ul>

      <label class="accept-wrap">
        <input type="checkbox" :checked="accepted" @change="onToggleAcceptance" />
        <span>I have read and accept the Cocolytics Terms and Conditions.</span>
      </label>

      <p class="state" :class="{ accepted: accepted }">
        {{ accepted ? 'Terms accepted. Return to dashboard to continue trader upgrade.' : 'Terms not accepted yet.' }}
      </p>

      <button type="button" class="back-btn" @click="goBackToDashboard">Go Back to Dashboard</button>
    </article>
  </section>
</template>

<style scoped>
.terms-page {
  display: grid;
  gap: 1rem;
}

.hero {
  border: 1px solid rgba(126, 229, 248, 0.29);
  border-radius: 18px;
  background: radial-gradient(circle at top right, rgba(37, 166, 175, 0.2), rgba(11, 49, 58, 0.86));
  padding: 1rem;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #9af4ff;
}

h1 {
  margin: 0.42rem 0 0;
  font-size: 1.45rem;
}

.subtitle {
  margin: 0.52rem 0 0;
  color: #cdf9ff;
}

.terms-card {
  border: 1px solid rgba(127, 217, 234, 0.34);
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(8, 35, 45, 0.9), rgba(12, 64, 76, 0.76));
  padding: 1rem;
}

h2 {
  margin: 0;
  font-size: 1rem;
  color: #e6fdff;
}

ul {
  margin: 0.6rem 0 0.9rem;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.45rem;
  color: #d6faff;
}

.accept-wrap {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  color: #ecfeff;
  font-weight: 700;
}

.accept-wrap input {
  margin-top: 0.15rem;
}

.state {
  margin: 0.85rem 0 0;
  color: #ffdfc5;
  font-weight: 700;
}

.state.accepted {
  color: #b6ffd8;
}

.back-btn {
  margin-top: 0.8rem;
  border: 1px solid rgba(127, 218, 234, 0.4);
  border-radius: 10px;
  background: rgba(7, 46, 58, 0.85);
  color: #e2fcff;
  padding: 0.52rem 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
</style>
