<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchTraderMessageContacts, sendTraderCallSignal } from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getUser } from '../../services/session';
import { ensureTraderRealtimeStream, subscribeTraderRealtime } from '../../services/traderRealtime';

const route = useRoute();
const router = useRouter();

const feedback = ref('');
const partner = ref(null);
const callStatus = ref('Initializing...');
const callMode = ref('audio');
const callId = ref(null);
const isMuted = ref(false);
const isCameraOff = ref(false);
const active = ref(false);

const stageRef = ref(null);
const localPreviewRef = ref(null);
const localVideoRef = ref(null);
const remoteVideoRef = ref(null);
const localPreviewX = ref(0);
const localPreviewY = ref(0);
const localPreviewReady = ref(false);
const isDraggingPreview = ref(false);

const dragState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
};

const videoDevices = ref([]);
const activeVideoDeviceId = ref('');
const cameraFacingMode = ref('user');
const canUseFacingModeSwitch = ref(false);

const currentUserId = computed(() => Number(getUser()?.id || 0));
const partnerId = computed(() => Number(route.query.traderId || 0));
const incoming = computed(() => String(route.query.incoming || '') === '1');
const isAndroidDevice = computed(() => /Android/i.test(navigator.userAgent || ''));
const canFlipCamera = computed(
  () => callMode.value === 'video' && isAndroidDevice.value && (videoDevices.value.length > 1 || canUseFacingModeSwitch.value)
);

let unsubscribeCall = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let ringtoneAudioContext = null;
let ringtoneTimer = null;
const pendingRemoteCandidates = [];

function buildRtcConfig() {
  return {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
}

function callModeLabel() {
  return callMode.value === 'video' ? 'Video Call' : 'Voice Call';
}

function clampLocalPreviewPosition() {
  if (!stageRef.value || !localPreviewRef.value) {
    return;
  }

  const stageRect = stageRef.value.getBoundingClientRect();
  const previewRect = localPreviewRef.value.getBoundingClientRect();
  const maxX = Math.max(0, stageRect.width - previewRect.width);
  const maxY = Math.max(0, stageRect.height - previewRect.height);

  localPreviewX.value = Math.min(Math.max(0, localPreviewX.value), maxX);
  localPreviewY.value = Math.min(Math.max(0, localPreviewY.value), maxY);
}

function setDefaultLocalPreviewPosition() {
  if (!stageRef.value || !localPreviewRef.value) {
    return;
  }

  const stageRect = stageRef.value.getBoundingClientRect();
  const previewRect = localPreviewRef.value.getBoundingClientRect();
  const margin = 14;

  localPreviewX.value = Math.max(0, stageRect.width - previewRect.width - margin);
  localPreviewY.value = Math.max(0, stageRect.height - previewRect.height - margin);
  localPreviewReady.value = true;
}

const localPreviewStyle = computed(() => {
  if (!localPreviewReady.value) {
    return { visibility: 'hidden' };
  }

  return {
    left: `${localPreviewX.value}px`,
    top: `${localPreviewY.value}px`,
  };
});

function onPreviewPointerDown(event) {
  if (callMode.value !== 'video') {
    return;
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  isDraggingPreview.value = true;
  dragState.pointerId = event.pointerId;
  dragState.startX = Number(event.clientX || 0);
  dragState.startY = Number(event.clientY || 0);
  dragState.originX = localPreviewX.value;
  dragState.originY = localPreviewY.value;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
}

function onPreviewPointerMove(event) {
  if (!isDraggingPreview.value || dragState.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = Number(event.clientX || 0) - dragState.startX;
  const deltaY = Number(event.clientY || 0) - dragState.startY;
  localPreviewX.value = dragState.originX + deltaX;
  localPreviewY.value = dragState.originY + deltaY;
  clampLocalPreviewPosition();
}

function stopPreviewDragging() {
  isDraggingPreview.value = false;
  dragState.pointerId = null;
}

async function refreshVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices.value = devices.filter((device) => device.kind === 'videoinput');

    const activeTrack = localStream?.getVideoTracks?.()[0] || null;
    const activeTrackDeviceId = activeTrack?.getSettings?.().deviceId || '';
    const activeFacingMode = String(activeTrack?.getSettings?.().facingMode || '').toLowerCase();
    const facingModeCaps = activeTrack?.getCapabilities?.().facingMode;

    if (activeTrackDeviceId) {
      activeVideoDeviceId.value = activeTrackDeviceId;
    } else if (!activeVideoDeviceId.value && videoDevices.value.length) {
      activeVideoDeviceId.value = videoDevices.value[0].deviceId;
    }

    if (activeFacingMode === 'user' || activeFacingMode === 'environment') {
      cameraFacingMode.value = activeFacingMode;
    }

    canUseFacingModeSwitch.value = Array.isArray(facingModeCaps)
      ? facingModeCaps.includes('user') && facingModeCaps.includes('environment')
      : false;
  } catch {
    videoDevices.value = [];
    canUseFacingModeSwitch.value = false;
  }
}

async function replaceLocalVideoTrack(newTrack) {
  if (!newTrack || !localStream) {
    return;
  }

  const oldTrack = localStream.getVideoTracks()[0] || null;
  if (oldTrack) {
    localStream.removeTrack(oldTrack);
    oldTrack.stop();
  }

  localStream.addTrack(newTrack);

  if (peerConnection) {
    const sender = peerConnection.getSenders().find((item) => item.track && item.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  if (localVideoRef.value) {
    localVideoRef.value.srcObject = localStream;
  }

  isCameraOff.value = false;
  newTrack.enabled = true;
  const nextFacingMode = String(newTrack.getSettings?.().facingMode || '').toLowerCase();
  if (nextFacingMode === 'user' || nextFacingMode === 'environment') {
    cameraFacingMode.value = nextFacingMode;
  }

  await refreshVideoDevices();
}

function playRingBurst() {
  if (!ringtoneAudioContext) {
    return;
  }

  const startAt = ringtoneAudioContext.currentTime;
  const offsets = [0, 0.32, 0.8, 1.12];

  for (const offset of offsets) {
    const oscillator = ringtoneAudioContext.createOscillator();
    const gain = ringtoneAudioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 810;

    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.08, startAt + offset + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.18);

    oscillator.connect(gain);
    gain.connect(ringtoneAudioContext.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.2);
  }
}

async function startRingingTone() {
  if (ringtoneTimer) {
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    ringtoneAudioContext = ringtoneAudioContext || new AudioContextClass();
    if (ringtoneAudioContext.state === 'suspended') {
      await ringtoneAudioContext.resume();
    }

    playRingBurst();
    ringtoneTimer = setInterval(() => {
      playRingBurst();
    }, 1850);
  } catch {
    // Some browsers block autoplay audio until user interaction.
  }
}

function stopRingingTone() {
  if (ringtoneTimer) {
    clearInterval(ringtoneTimer);
    ringtoneTimer = null;
  }
}

function resetMediaStreams() {
  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }

  if (remoteStream) {
    for (const track of remoteStream.getTracks()) {
      track.stop();
    }
    remoteStream = null;
  }

  if (localVideoRef.value) {
    localVideoRef.value.srcObject = null;
  }

  if (remoteVideoRef.value) {
    remoteVideoRef.value.srcObject = null;
  }
}

function cleanupConnection() {
  if (peerConnection) {
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }

  pendingRemoteCandidates.splice(0, pendingRemoteCandidates.length);
  stopRingingTone();
  resetMediaStreams();
}

async function sendSignal(signalType, payload = {}) {
  if (!partnerId.value) {
    return;
  }

  try {
    const data = await sendTraderCallSignal(partnerId.value, signalType, {
      ...payload,
      callId: callId.value,
      mode: callMode.value,
    });
    if (data?.callId) {
      callId.value = Number(data.callId);
    }
  } catch {
    // Ignore transient signaling errors to avoid breaking in-call UX.
  }
}

async function loadPartnerInfo() {
  try {
    const data = await fetchTraderMessageContacts();
    const contact = (data.contacts || []).find((item) => Number(item.traderId) === partnerId.value);
    if (contact) {
      partner.value = {
        id: Number(contact.traderId),
        name: contact.traderName || 'Trader',
        profileImagePath: contact.profileImagePath || '',
        isOnline: Boolean(contact.isOnline),
        lastSeenAt: contact.lastSeenAt || null,
      };
      return;
    }
  } catch {
    // No-op fallback below.
  }

  partner.value = {
    id: partnerId.value,
    name: `Trader #${partnerId.value}`,
    profileImagePath: '',
    isOnline: false,
    lastSeenAt: null,
  };
}

async function startLocalMedia() {
  const wantsVideo = callMode.value === 'video';
  const videoConstraint = wantsVideo
    ? activeVideoDeviceId.value
      ? { deviceId: { exact: activeVideoDeviceId.value } }
      : { facingMode: { ideal: cameraFacingMode.value } }
    : false;

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: videoConstraint,
  });

  if (localVideoRef.value) {
    localVideoRef.value.srcObject = localStream;
  }

  await refreshVideoDevices();
  await nextTick();
  if (wantsVideo) {
    setDefaultLocalPreviewPosition();
  }
}

async function createPeerConnection() {
  if (peerConnection) {
    return peerConnection;
  }

  const pc = new RTCPeerConnection(buildRtcConfig());

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal('call:ice', { candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
    }

    for (const track of event.streams[0]?.getTracks() || []) {
      remoteStream.addTrack(track);
    }

    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = remoteStream;
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      callStatus.value = 'Connected';
      active.value = true;
      stopRingingTone();
    }

    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      callStatus.value = 'Call ended';
      active.value = false;
      stopRingingTone();
    }
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }

  peerConnection = pc;

  while (pendingRemoteCandidates.length) {
    const candidate = pendingRemoteCandidates.shift();
    if (candidate) {
      pc.addIceCandidate(candidate).catch(() => {});
    }
  }

  return pc;
}

async function startOutgoingCall() {
  callStatus.value = partner.value?.isOnline ? 'Ringing...' : 'Calling...';
  await startLocalMedia();
  await createPeerConnection();
  await startRingingTone();
  await sendSignal('call:invite', { mode: callMode.value });
}

async function acceptIncomingCall() {
  callStatus.value = 'Connecting...';
  stopRingingTone();
  await startLocalMedia();
  await createPeerConnection();
  await sendSignal('call:accept', { mode: callMode.value });
}

async function sendOffer() {
  if (!peerConnection) {
    return;
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await sendSignal('call:offer', { sdp: offer });
}

async function endCall(leavePage = true) {
  await sendSignal('call:end', {});
  cleanupConnection();
  active.value = false;

  if (leavePage) {
    router.push({ name: 'trader-messages', query: { traderId: String(partnerId.value || '') } });
  }
}

function toggleMute() {
  if (!localStream) {
    return;
  }

  const audioTracks = localStream.getAudioTracks();
  isMuted.value = !isMuted.value;

  for (const track of audioTracks) {
    track.enabled = !isMuted.value;
  }
}

function toggleCamera() {
  if (callMode.value !== 'video' || !localStream) {
    return;
  }

  const videoTracks = localStream.getVideoTracks();
  isCameraOff.value = !isCameraOff.value;

  for (const track of videoTracks) {
    track.enabled = !isCameraOff.value;
  }
}

async function detachCurrentVideoTrack() {
  if (!localStream) {
    return null;
  }

  const currentTrack = localStream.getVideoTracks()[0] || null;
  if (!currentTrack) {
    return null;
  }

  localStream.removeTrack(currentTrack);
  if (peerConnection) {
    const sender = peerConnection.getSenders().find((item) => item.track && item.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(null);
    }
  }
  currentTrack.stop();
  return currentTrack;
}

async function recoverPreviousVideoTrack(previousSettings = {}) {
  if (!localStream) {
    return;
  }

  try {
    const recoveryConstraint = previousSettings.deviceId
      ? { deviceId: { exact: previousSettings.deviceId } }
      : previousSettings.facingMode
        ? { facingMode: { ideal: previousSettings.facingMode } }
        : true;

    const recoveryStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: recoveryConstraint,
    });
    const recoveryTrack = recoveryStream.getVideoTracks()[0] || null;
    if (recoveryTrack) {
      await replaceLocalVideoTrack(recoveryTrack);
    }
  } catch {
    // If recovery fails, keep audio call alive and report error to user.
  }
}

async function flipCamera() {
  if (!canFlipCamera.value || !localStream) {
    return;
  }

  const nextFacingMode = cameraFacingMode.value === 'environment' ? 'user' : 'environment';
  const currentTrack = localStream.getVideoTracks()[0] || null;
  const previousSettings = currentTrack?.getSettings?.() || {};

  // Preferred path on Android: switch source on the same track.
  if (currentTrack?.applyConstraints && canUseFacingModeSwitch.value) {
    try {
      await currentTrack.applyConstraints({
        facingMode: { ideal: nextFacingMode },
      });
      const updatedFacingMode = String(currentTrack.getSettings?.().facingMode || '').toLowerCase();
      if (updatedFacingMode === 'user' || updatedFacingMode === 'environment') {
        cameraFacingMode.value = updatedFacingMode;
      } else {
        cameraFacingMode.value = nextFacingMode;
      }
      await refreshVideoDevices();
      feedback.value = '';
      return;
    } catch {
      // Fall through to stream replacement path.
    }
  }

  let releasedForRetry = false;

  const openStreamByFacing = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: nextFacingMode } },
    });
    const track = stream.getVideoTracks()[0] || null;
    if (!track) {
      throw new Error('Could not access alternate camera.');
    }
    return track;
  };

  try {
    const newTrack = await openStreamByFacing();

    cameraFacingMode.value = nextFacingMode;
    await replaceLocalVideoTrack(newTrack);
    feedback.value = '';
  } catch (error) {
    if (currentTrack) {
      try {
        await detachCurrentVideoTrack();
        releasedForRetry = true;
      } catch {
        // Keep trying fallbacks even if detaching fails.
      }
    }

    try {
      const retryTrack = await openStreamByFacing();
      cameraFacingMode.value = nextFacingMode;
      await replaceLocalVideoTrack(retryTrack);
      feedback.value = '';
      return;
    } catch {
      // Continue to device-id fallback.
    }

    const list = videoDevices.value;
    if (list.length < 2) {
      if (releasedForRetry) {
        await recoverPreviousVideoTrack(previousSettings);
      }
      feedback.value = error?.message || 'Could not flip camera.';
      return;
    }

    const currentIndex = Math.max(0, list.findIndex((device) => device.deviceId === activeVideoDeviceId.value));
    const nextIndex = (currentIndex + 1) % list.length;
    const nextDeviceId = list[nextIndex].deviceId;

    try {
      const byDeviceStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: nextDeviceId } },
      });
      const newTrack = byDeviceStream.getVideoTracks()[0];
      if (!newTrack) {
        throw new Error('Could not access selected camera.');
      }

      activeVideoDeviceId.value = nextDeviceId;
      await replaceLocalVideoTrack(newTrack);
      feedback.value = '';
    } catch (innerError) {
      if (releasedForRetry) {
        await recoverPreviousVideoTrack(previousSettings);
      }
      feedback.value = 'Could not start video source for camera flip.';
    }
  }
}

function iconPath(kind) {
  if (kind === 'mute') {
    return isMuted.value
      ? 'M16 12a4 4 0 0 1-8 0V8a4 4 0 0 1 8 0z M4 10v2a8 8 0 0 0 14.3 4.9l1.4 1.4 1.3-1.3L3.3 1.3 2 2.6l3 3A8 8 0 0 0 4 10z'
      : 'M16 12a4 4 0 0 1-8 0V8a4 4 0 0 1 8 0z M6 12a6 6 0 0 0 12 0h2a8 8 0 0 1-7 7.9V22h-2v-2.1A8 8 0 0 1 4 12z';
  }

  if (kind === 'camera') {
    return isCameraOff.value
      ? 'M4 6h10l6 6v8H4z M7 9l8 8 M18 7l3-3 1.5 1.5L5.5 22.5 4 21z'
      : 'M3 7h12l5-3v16l-5-3H3z M9 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
  }

  return 'M3 7h12l5-3v16l-5-3H3z';
}

async function handleCallEvent(rawEvent) {
  const event = JSON.parse(rawEvent?.data || '{}');
  if (event?.type !== 'call:signal') {
    return;
  }

  const signalType = String(event.signalType || '').toLowerCase();
  const fromTraderId = Number(event.fromTraderId);
  const toTraderId = Number(event.toTraderId);
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  if (payload?.callId) {
    callId.value = Number(payload.callId);
  }

  if (fromTraderId === currentUserId.value) {
    return;
  }

  if (fromTraderId !== partnerId.value && toTraderId !== partnerId.value) {
    return;
  }

  if (signalType === 'call:accept') {
    callStatus.value = 'Connecting...';
    stopRingingTone();
    await sendOffer();
    return;
  }

  if (signalType === 'call:decline') {
    callStatus.value = 'Declined';
    active.value = false;
    stopRingingTone();
    return;
  }

  if (signalType === 'call:end') {
    callStatus.value = 'Call ended';
    active.value = false;
    stopRingingTone();
    cleanupConnection();
    return;
  }

  if (signalType === 'call:offer') {
    await createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await sendSignal('call:answer', { sdp: answer });
    return;
  }

  if (signalType === 'call:answer') {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    }
    return;
  }

  if (signalType === 'call:ice') {
    const candidate = payload?.candidate;
    if (!candidate) {
      return;
    }

    if (peerConnection && peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      pendingRemoteCandidates.push(new RTCIceCandidate(candidate));
    }
  }
}

function goBack() {
  endCall(true);
}

async function initializeCallPage() {
  const parsedMode = String(route.query.mode || 'audio').toLowerCase();
  callMode.value = parsedMode === 'video' ? 'video' : 'audio';
  const parsedCallId = Number(route.query.callId);
  callId.value = Number.isInteger(parsedCallId) && parsedCallId > 0 ? parsedCallId : null;

  if (!Number.isInteger(partnerId.value) || partnerId.value <= 0) {
    feedback.value = 'Invalid call target.';
    return;
  }

  await loadPartnerInfo();
  ensureTraderRealtimeStream();
  unsubscribeCall = subscribeTraderRealtime('chat-call', (rawEvent) => {
    handleCallEvent(rawEvent).catch((error) => {
      console.error('[call] event handling failed', error);
    });
  });

  await nextTick();

  try {
    if (incoming.value) {
      await acceptIncomingCall();
    } else {
      await startOutgoingCall();
    }
  } catch (error) {
    feedback.value = error?.message || 'Could not start call.';
  }
}

watch(
  () => route.query,
  () => {
    // If route changes while on page, this page should reinitialize on navigation.
  }
);

onMounted(() => {
  initializeCallPage();
  window.addEventListener('resize', clampLocalPreviewPosition);
});

onUnmounted(() => {
  if (unsubscribeCall) {
    unsubscribeCall();
    unsubscribeCall = null;
  }

  stopRingingTone();
  if (ringtoneAudioContext) {
    ringtoneAudioContext.close().catch(() => {});
    ringtoneAudioContext = null;
  }
  window.removeEventListener('resize', clampLocalPreviewPosition);
  cleanupConnection();
});
</script>

<template>
  <section class="call-page">
    <header class="call-header">
      <button type="button" class="back-btn" @click="goBack">Back</button>
      <div class="title-wrap">
        <p class="kicker">{{ callModeLabel() }}</p>
        <h1>{{ partner?.name || 'Trader' }}</h1>
        <p class="status">{{ callStatus }}</p>
      </div>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div ref="stageRef" class="video-stage" :class="{ audio: callMode === 'audio' }">
      <video ref="remoteVideoRef" autoplay playsinline class="remote-video" />
      <div
        ref="localPreviewRef"
        class="local-preview"
        :class="{ hidden: callMode === 'audio', dragging: isDraggingPreview }"
        :style="localPreviewStyle"
        @pointerdown="onPreviewPointerDown"
        @pointermove="onPreviewPointerMove"
        @pointerup="stopPreviewDragging"
        @pointercancel="stopPreviewDragging"
      >
        <video ref="localVideoRef" autoplay playsinline muted class="local-video" />
      </div>

      <div v-if="callMode === 'audio'" class="audio-card">
        <img
          v-if="partner?.profileImagePath"
          :src="toMediaUrl(partner.profileImagePath)"
          :alt="partner?.name || 'Trader'"
          class="audio-avatar"
        />
        <div v-else class="audio-avatar placeholder">
          {{ (partner?.name || 'T').slice(0, 1).toUpperCase() }}
        </div>
        <p>{{ partner?.name || 'Trader' }}</p>
      </div>
    </div>

    <footer class="controls">
      <button type="button" class="icon-btn" :class="{ active: isMuted }" @click="toggleMute" title="Mute/unmute">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="iconPath('mute')" /></svg>
      </button>

      <button
        type="button"
        class="icon-btn"
        :class="{ active: isCameraOff }"
        :disabled="callMode !== 'video'"
        @click="toggleCamera"
        title="Camera on/off"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="iconPath('camera')" /></svg>
      </button>

      <button
        v-if="canFlipCamera"
        type="button"
        class="icon-btn"
        @click="flipCamera"
        title="Flip camera"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h7l2-2 2 2v5h-2V9h-2l2 2-1.4 1.4L10.2 8l4.4-4.4L16 5H7zm10 10H10l-2 2-2-2v-5h2v3h2l-2-2 1.4-1.4L13.8 16l-4.4 4.4L8 19h9z" /></svg>
      </button>

      <button type="button" class="icon-btn end" @click="endCall(true)" title="End call">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l2.5 2.5c3-3 8-3 11 0L20 16c-4-4.5-12-4.5-16 0z" /></svg>
      </button>
    </footer>
  </section>
</template>

<style scoped>
.call-page {
  min-height: calc(100vh - 4.4rem);
  border: 1px solid rgba(81, 105, 138, 0.44);
  border-radius: 18px;
  background: radial-gradient(circle at 15% 20%, #223956 0%, #0f1825 58%, #0a111a 100%);
  padding: 0.95rem;
  color: #eef6ff;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.75rem;
}

.call-header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.back-btn {
  border: 1px solid rgba(133, 173, 255, 0.42);
  background: #1b314b;
  color: #edf4ff;
  border-radius: 999px;
  padding: 0.34rem 0.72rem;
  font-weight: 700;
}

.kicker {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #9fcbff;
}

.title-wrap h1 {
  margin: 0.1rem 0 0;
  font-size: 1.35rem;
}

.status {
  margin: 0.25rem 0 0;
  color: #b7cbef;
}

.feedback {
  margin: 0;
  color: #ffb8c5;
}

.video-stage {
  position: relative;
  border: 1px solid rgba(96, 122, 156, 0.4);
  border-radius: 16px;
  overflow: hidden;
  min-height: 58vh;
  background: #08131f;
}

.remote-video {
  width: 100%;
  height: 100%;
  min-height: 58vh;
  object-fit: cover;
  background: #060c14;
}

.local-preview {
  position: absolute;
  width: 30%;
  max-width: 240px;
  min-width: 130px;
  border-radius: 12px;
  border: 1px solid rgba(153, 180, 221, 0.4);
  background: #0c1724;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
}

.local-preview.dragging {
  cursor: grabbing;
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.local-preview.hidden {
  display: none;
}

.audio-card {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 0.6rem;
}

.audio-avatar {
  width: 90px;
  height: 90px;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(147, 178, 255, 0.48);
}

.audio-avatar.placeholder {
  display: grid;
  place-items: center;
  background: #263548;
  color: #eef4ff;
  font-size: 1.25rem;
  font-weight: 800;
}

.audio-card p {
  margin: 0;
  color: #d7e7ff;
  font-weight: 700;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 0.72rem;
}

.icon-btn {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: 1px solid rgba(136, 166, 211, 0.44);
  background: #1c2f46;
  color: #ecf3ff;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-btn svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.icon-btn.active {
  background: #3a2f56;
  border-color: rgba(177, 146, 244, 0.52);
}

.icon-btn.end {
  background: #712f3a;
  border-color: rgba(255, 128, 151, 0.45);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 860px) {
  .call-page {
    min-height: calc(100vh - 4rem);
    padding: 0.7rem;
  }

  .remote-video {
    min-height: 54vh;
  }

  .local-preview {
    width: 36%;
  }
}
</style>
