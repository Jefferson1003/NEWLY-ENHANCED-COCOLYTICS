<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { acceptTraderRole, fetchMe } from '../../services/api';
import { clearSession, saveSession, getToken } from '../../services/session';

const router = useRouter();
const profile = ref(null);
const feedback = ref('');
const loading = ref(true);
let pollTimer;

function logout() {
  clearSession();
  router.push('/auth');
}

async function loadProfile() {
  try {
    const data = await fetchMe();
    profile.value = data.user;
    saveSession(getToken(), data.user);

    if (data.user.role === 'trader' || data.user.status === 'trader') {
      router.push('/trader');
    }
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function applyAsTrader() {
  feedback.value = '';
  try {
    const result = await acceptTraderRole();
    feedback.value = result.message;
    await loadProfile();
  } catch (error) {
    feedback.value = error.message;
  }
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
  <section class="client-page">
    <header class="client-top">
      <div>
        <p class="kicker">Client Center</p>
        <h1>Welcome, {{ profile?.fullName || 'Client' }}</h1>
      </div>
      <button class="logout" @click="logout">Logout</button>
    </header>

    <article class="status-card" v-if="!loading">
      <p><strong>Email:</strong> {{ profile?.email }}</p>
      <p><strong>Status:</strong> {{ profile?.status }}</p>
      <p><strong>Role:</strong> {{ profile?.role }}</p>

      <button
        v-if="profile?.status === 'accepted_client'"
        class="staff-btn"
        @click="applyAsTrader"
      >
        Accept as Trader
      </button>

      <p v-if="profile?.status === 'trader'" class="note">Your account is now upgraded as trader.</p>
      <p v-if="profile?.status === 'pending_client'" class="note">Your client account is still pending admin approval.</p>
    </article>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.client-page {
  min-height: 100vh;
  padding: 1rem;
  color: #edfff6;
}

.client-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.7rem;
  color: #96f7ce;
}

h1 {
  margin: 0.45rem 0 0;
  font-size: 1.4rem;
}

.logout,
.staff-btn {
  border: 1px solid rgba(125, 235, 196, 0.42);
  border-radius: 10px;
  background: rgba(13, 57, 71, 0.72);
  color: #effff7;
  padding: 0.55rem 0.78rem;
  font-weight: 700;
}

.status-card {
  margin-top: 1rem;
  border: 1px solid rgba(111, 214, 176, 0.35);
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(8, 35, 46, 0.88), rgba(10, 57, 72, 0.68));
  padding: 1rem;
  display: grid;
  gap: 0.65rem;
}

.note {
  margin: 0;
  color: #bff6dd;
  font-size: 0.83rem;
}

.feedback {
  margin-top: 0.8rem;
  color: #8aeec4;
}
</style>
