<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ClientSidebar from '../../components/ClientSidebar.vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import {
  fetchClientMessageContacts,
  fetchMe,
  sendClientCallSignal,
} from '../../services/api';
import { toastInfo } from '../../services/toast';
import { clearSession, saveSession, getToken, getUser } from '../../services/session';
import { ensureClientRealtimeStream, subscribeClientRealtime } from '../../services/clientRealtime';

const router = useRouter();
const profile = ref(null);
const feedback = ref('');
const sidebarOpen = ref(false);
const showLogoutConfirm = ref(false);
const incomingCall = ref(null);
let pollTimer;
let unsubscribeCallEvent = null;
let unsubscribeMessageEvent = null;
let incomingRingAudioContext = null;
let incomingRingTimer = null;
const shownMessageToastIds = new Set();

function playIncomingRingBurst() {
  if (!incomingRingAudioContext) {
    return;
  }

  const startAt = incomingRingAudioContext.currentTime;
  const offsets = [0, 0.24, 0.7, 0.94];

  for (const offset of offsets) {
    const oscillator = incomingRingAudioContext.createOscillator();
    const gain = incomingRingAudioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = 720;

    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.085, startAt + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.16);

    oscillator.connect(gain);
    gain.connect(incomingRingAudioContext.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.18);
  }
}

async function startIncomingRingtone() {
  if (incomingRingTimer) {
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    incomingRingAudioContext = incomingRingAudioContext || new AudioContextClass();
    if (incomingRingAudioContext.state === 'suspended') {
      await incomingRingAudioContext.resume();
    }

    playIncomingRingBurst();
    incomingRingTimer = setInterval(() => {
      playIncomingRingBurst();
    }, 1700);
  } catch {
    // Browser may block sound before user interaction.
  }
}

function stopIncomingRingtone() {
  if (incomingRingTimer) {
    clearInterval(incomingRingTimer);
    incomingRingTimer = null;
  }
}

async function resolveAdminName(adminId) {
  try {
    const data = await fetchClientMessageContacts();
    const contact = (data.contacts || []).find((item) => Number(item.traderId) === Number(adminId));
    if (contact?.traderName) {
      return contact.traderName;
    }
  } catch {
    // Silent fallback below.
  }

  return `Admin #${adminId}`;
}

async function handleIncomingCallEvent(rawEvent) {
  const payload = JSON.parse(rawEvent?.data || '{}');
  if (payload?.type !== 'call:signal') {
    return;
  }

  const signalType = String(payload.signalType || '').toLowerCase();
  const fromTraderId = Number(payload.fromTraderId);
  const toTraderId = Number(payload.toTraderId);
  const mode = String(payload?.payload?.mode || 'audio').toLowerCase() === 'video' ? 'video' : 'audio';
  const currentUserId = Number(getUser()?.id || 0);

  if (!currentUserId || fromTraderId === currentUserId) {
    return;
  }

  if (signalType === 'call:invite' && toTraderId === currentUserId) {
    incomingCall.value = {
      fromTraderId,
      mode,
      callId: Number(payload?.payload?.callId || 0) || null,
      traderName: await resolveAdminName(fromTraderId),
    };
    startIncomingRingtone();
    return;
  }

  if (signalType === 'call:end' || signalType === 'call:decline') {
    if (incomingCall.value && Number(incomingCall.value.fromTraderId) === fromTraderId) {
      incomingCall.value = null;
      stopIncomingRingtone();
    }
  }
}

async function handleIncomingMessageEvent(rawEvent) {
  const payload = JSON.parse(rawEvent?.data || '{}');
  if (payload?.type !== 'message:new' || !payload?.message) {
    return;
  }

  const messageId = Number(payload?.message?.id || 0);
  if (messageId > 0 && shownMessageToastIds.has(messageId)) {
    return;
  }

  if (messageId > 0) {
    shownMessageToastIds.add(messageId);
  }

  const senderId = Number(payload?.message?.senderId || 0);
  const currentUserId = Number(getUser()?.id || 0);
  if (!currentUserId || senderId === currentUserId) {
    return;
  }

  const senderName = await resolveAdminName(senderId);
  const preview = String(payload?.message?.messageText || '').trim()
    || (payload?.message?.messageImagePath ? 'Sent an image.' : 'New message received.');
  toastInfo(preview, senderName, 2800);
}

function acceptIncomingCall() {
  if (!incomingCall.value) {
    return;
  }

  const call = incomingCall.value;
  incomingCall.value = null;
  stopIncomingRingtone();
  router.push({
    name: 'client-call',
    query: {
      traderId: String(call.fromTraderId),
      mode: call.mode,
      callId: call.callId ? String(call.callId) : '',
      incoming: '1',
    },
  });
}

async function declineIncomingCall() {
  if (!incomingCall.value) {
    return;
  }

  const call = incomingCall.value;
  incomingCall.value = null;
  stopIncomingRingtone();
  try {
    await sendClientCallSignal(call.fromTraderId, 'call:decline', {});
  } catch {
    // Ignore decline failures; call invite will timeout on sender side.
  }
}

function logout() {
  clearSession();
  router.push('/auth');
}

function requestLogout() {
  showLogoutConfirm.value = true;
}

function cancelLogout() {
  showLogoutConfirm.value = false;
}

function confirmLogout() {
  showLogoutConfirm.value = false;
  logout();
}

async function loadProfile() {
  try {
    const data = await fetchMe();
    profile.value = data.user;
    saveSession(getToken(), data.user);

    if (data.user.role === 'trader' || data.user.status === 'trader') {
      router.push('/trader/dashboard');
    }
  } catch (error) {
    feedback.value = error.message;
  }
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebar() {
  sidebarOpen.value = false;
}

onMounted(async () => {
  await loadProfile();
  pollTimer = setInterval(loadProfile, 8000);
  ensureClientRealtimeStream();
  unsubscribeCallEvent = subscribeClientRealtime('chat-call', (rawEvent) => {
    handleIncomingCallEvent(rawEvent).catch((error) => {
      console.error('[client] incoming call handling failed', error);
    });
  });
  unsubscribeMessageEvent = subscribeClientRealtime('chat-message', (rawEvent) => {
    handleIncomingMessageEvent(rawEvent).catch((error) => {
      console.error('[client] incoming message handling failed', error);
    });
  });
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  if (unsubscribeCallEvent) {
    unsubscribeCallEvent();
    unsubscribeCallEvent = null;
  }

  if (unsubscribeMessageEvent) {
    unsubscribeMessageEvent();
    unsubscribeMessageEvent = null;
  }

  shownMessageToastIds.clear();

  stopIncomingRingtone();
  if (incomingRingAudioContext) {
    incomingRingAudioContext.close().catch(() => {});
    incomingRingAudioContext = null;
  }
});
</script>

<template>
  <section class="client-layout">
    <ClientSidebar
      :user-name="profile?.fullName || 'Client'"
      :user-email="profile?.email || ''"
      :is-open="sidebarOpen"
      @logout="requestLogout"
      @close="closeSidebar"
    />

    <button
      v-if="!sidebarOpen"
      :class="['toggle', { open: sidebarOpen }]"
      type="button"
      aria-label="Toggle sidebar"
      @click="toggleSidebar"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div v-if="sidebarOpen" class="overlay" @click="closeSidebar"></div>

    <main class="client-page">
      <p v-if="feedback" class="feedback">{{ feedback }}</p>
      <router-view />

      <section v-if="incomingCall" class="incoming-toast">
        <p class="toast-title">Incoming {{ incomingCall.mode === 'video' ? 'Video' : 'Voice' }} Call</p>
        <p class="toast-sub">{{ incomingCall.traderName }}</p>
        <div class="toast-actions">
          <button type="button" class="toast-btn accept" @click="acceptIncomingCall" title="Accept call">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l2.5 2.5c3-3 8-3 11 0L20 16c-4-4.5-12-4.5-16 0z" /></svg>
          </button>
          <button type="button" class="toast-btn decline" @click="declineIncomingCall" title="Decline call">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l2.5-2.5c3 3 8 3 11 0L20 8c-4 4.5-12 4.5-16 0z" /></svg>
          </button>
        </div>
      </section>
    </main>

    <ConfirmationModal
      :visible="showLogoutConfirm"
      title="Confirm Logout"
      message="Are you sure you want to logout?"
      confirm-label="Yes, Logout"
      cancel-label="Cancel"
      :danger="true"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    />
  </section>
</template>

<style scoped>
.client-layout {
  min-height: 100vh;
  background: #071c24;
  position: relative;
  overflow: hidden;
}

.client-page {
  padding: 1rem;
  padding-top: 3.2rem;
  color: #edfff6;
}

.toggle {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  position: fixed;
  top: 0.85rem;
  left: 0.85rem;
  z-index: 35;
  border: 1px solid rgba(151, 233, 255, 0.46);
  border-radius: 10px;
  background: rgba(13, 49, 60, 0.95);
  color: #e7fcff;
  width: 38px;
  height: 34px;
  padding: 0.35rem;
}

.toggle span {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: #e7fcff;
}

.feedback {
  margin: 0 0 0.8rem;
  color: #ffbfca;
}

.overlay {
  display: block;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 25;
}

.incoming-toast {
  position: fixed;
  top: 0.95rem;
  right: 0.95rem;
  z-index: 60;
  width: min(320px, calc(100vw - 1.9rem));
  border: 1px solid rgba(130, 167, 217, 0.42);
  border-radius: 12px;
  background: #18273a;
  padding: 0.65rem 0.72rem;
  box-shadow: 0 10px 30px rgba(3, 8, 16, 0.38);
}

.toast-title,
.toast-sub {
  margin: 0;
}

.toast-title {
  color: #e7f2ff;
  font-size: 0.86rem;
  font-weight: 800;
}

.toast-sub {
  margin-top: 0.16rem;
  color: #bdd5f6;
  font-size: 0.78rem;
}

.toast-actions {
  margin-top: 0.56rem;
  display: flex;
  gap: 0.5rem;
}

.toast-btn {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid transparent;
  color: #f7fbff;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.toast-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.toast-btn.accept {
  background: #2e7b52;
  border-color: rgba(133, 236, 183, 0.4);
}

.toast-btn.decline {
  background: #7f3344;
  border-color: rgba(255, 150, 174, 0.34);
}

@media (max-width: 820px) {
  .client-page {
    padding-top: 3.2rem;
  }

  .incoming-toast {
    top: 0.7rem;
    right: 0.7rem;
  }
}
</style>
