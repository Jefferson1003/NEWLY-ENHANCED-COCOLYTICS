<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { fetchClientMessageContacts, sendClientCallSignal } from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getUser } from '../../services/session';
import { ensureClientRealtimeStream, subscribeClientRealtime } from '../../services/clientRealtime';

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
const callTerminated = ref(false);
const allowLeaveAfterEnd = ref(false);
const showOngoingPrompt = ref(false);
const connectedAtMs = ref(null);
const durationSeconds = ref(0);
const endedDurationSeconds = ref(0);

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
const isiOSDevice = computed(() => /iPad|iPhone|iPod/i.test(navigator.userAgent || ''));
const canFlipCamera = computed(
  () => callMode.value === 'video' && (videoDevices.value.length > 1 || canUseFacingModeSwitch.value || isiOSDevice.value)
);
const hasRemoteVideoTrack = computed(() => {
  const tracks = remoteStream?.getVideoTracks?.() || [];
  return tracks.some((track) => track.readyState === 'live' && track.enabled !== false);
});
const showEndedCard = computed(() => callTerminated.value);
const showWaitingCard = computed(() => !callTerminated.value && (!active.value || !showVideoStreams.value));
const showVideoStreams = computed(() => callMode.value === 'video' && active.value && !callTerminated.value && hasRemoteVideoTrack.value);
const endedDurationLabel = computed(() => formatDuration(endedDurationSeconds.value));
const waitingStatusLabel = computed(() => {
  if (callStatus.value === 'Connected' && !showVideoStreams.value) {
    return 'Waiting for camera/video...';
  }

  return callStatus.value;
});
const isCallOngoing = computed(() => {
  if (callTerminated.value || allowLeaveAfterEnd.value) {
    return false;
  }

  const liveStatuses = ['calling...', 'ringing...', 'connecting...', 'connected'];
  const normalizedStatus = String(callStatus.value || '').trim().toLowerCase();
  return Boolean(peerConnection || localStream || liveStatuses.includes(normalizedStatus));
});

let unsubscribeCall = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let ringtoneAudioContext = null;
let ringtoneTimer = null;
let durationTimer = null;
let endRedirectTimer = null;
const pendingRemoteCandidates = [];

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startDurationTicker() {
  if (connectedAtMs.value === null) {
    connectedAtMs.value = Date.now();
  }

  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }

  durationTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - connectedAtMs.value) / 1000);
    durationSeconds.value = Math.max(0, elapsed);
  }, 1000);
}

function stopDurationTicker() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

function clearEndRedirectTimer() {
  if (endRedirectTimer) {
    clearTimeout(endRedirectTimer);
    endRedirectTimer = null;
  }
}

function scheduleEndRedirectToMessages() {
  clearEndRedirectTimer();
  endRedirectTimer = setTimeout(() => {
    router.replace({ name: 'client-messages', query: { traderId: String(partnerId.value || '') } });
  }, 5000);
}

function markCallEnded(reason = 'Call ended') {
  stopDurationTicker();
  endedDurationSeconds.value = Math.max(0, durationSeconds.value);
  callStatus.value = reason;
  scheduleEndRedirectToMessages();
}

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

function schedulePreviewFit(resetToDefault = false) {
  if (callMode.value !== 'video') {
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (resetToDefault || !localPreviewReady.value) {
        setDefaultLocalPreviewPosition();
      }
      clampLocalPreviewPosition();
    });
  });
}

function handleViewportResize() {
  schedulePreviewFit(false);
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

  durationSeconds.value = Math.max(0, durationSeconds.value);
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
  stopDurationTicker();
  resetMediaStreams();
}

async function sendSignal(signalType, payload = {}) {
  if (!partnerId.value) {
    return;
  }

  try {
    const data = await sendClientCallSignal(partnerId.value, signalType, {
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
    const data = await fetchClientMessageContacts();
    const contact = (data.contacts || []).find((item) => Number(item.traderId) === partnerId.value);
    if (contact) {
      partner.value = {
        id: Number(contact.traderId),
        name: contact.traderName || 'Admin',
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
    name: `Admin #${partnerId.value}`,
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
    schedulePreviewFit(true);
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
      startDurationTicker();
      schedulePreviewFit(false);
    }

    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      markCallEnded('Call ended');
      active.value = false;
      callTerminated.value = true;
      allowLeaveAfterEnd.value = true;
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
  callTerminated.value = true;
  allowLeaveAfterEnd.value = true;
  await sendSignal('call:end', {});
  markCallEnded('Call ended');
  cleanupConnection();
  active.value = false;

  if (leavePage) {
    router.replace({ name: 'client-messages', query: { traderId: String(partnerId.value || '') } });
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

async function forceRestartMediaForFlip(preferredConstraint) {
  if (!peerConnection) {
    throw new Error('Call connection is not ready.');
  }

  const previousTracks = localStream ? [...localStream.getTracks()] : [];
  for (const track of previousTracks) {
    track.stop();
  }

  const restartedStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: preferredConstraint,
  });

  localStream = restartedStream;

  const newAudioTrack = restartedStream.getAudioTracks()[0] || null;
  const newVideoTrack = restartedStream.getVideoTracks()[0] || null;

  for (const sender of peerConnection.getSenders()) {
    if (!sender.track) {
      continue;
    }

    if (sender.track.kind === 'audio' && newAudioTrack) {
      await sender.replaceTrack(newAudioTrack);
    }

    if (sender.track.kind === 'video' && newVideoTrack) {
      await sender.replaceTrack(newVideoTrack);
    }
  }

  if (localVideoRef.value) {
    localVideoRef.value.srcObject = localStream;
  }

  if (isMuted.value && newAudioTrack) {
    newAudioTrack.enabled = false;
  }

  if (isCameraOff.value && newVideoTrack) {
    newVideoTrack.enabled = false;
  }

  const nextFacingMode = String(newVideoTrack?.getSettings?.().facingMode || '').toLowerCase();
  if (nextFacingMode === 'user' || nextFacingMode === 'environment') {
    cameraFacingMode.value = nextFacingMode;
  }

  await refreshVideoDevices();
  schedulePreviewFit(false);
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
    const constraintsToTry = [
      { facingMode: { exact: nextFacingMode } },
      { facingMode: { ideal: nextFacingMode } },
      { facingMode: nextFacingMode },
    ];

    for (const constraint of constraintsToTry) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: constraint,
        });
        const track = stream.getVideoTracks()[0] || null;
        if (track) {
          return track;
        }
      } catch {
        // Keep trying fallback constraints.
      }
    }

    throw new Error('Could not access alternate camera.');
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
      try {
        await forceRestartMediaForFlip({ facingMode: { ideal: nextFacingMode } });
        feedback.value = '';
        return;
      } catch {
        if (releasedForRetry) {
          await recoverPreviousVideoTrack(previousSettings);
        }
        feedback.value = 'Could not start video source for camera flip.';
      }
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
    markCallEnded('Declined');
    active.value = false;
    callTerminated.value = true;
    allowLeaveAfterEnd.value = true;
    stopRingingTone();
    return;
  }

  if (signalType === 'call:end') {
    markCallEnded('Call ended');
    active.value = false;
    callTerminated.value = true;
    allowLeaveAfterEnd.value = true;
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
  if (isCallOngoing.value) {
    showOngoingPrompt.value = true;
    return;
  }

  router.replace({ name: 'client-messages', query: { traderId: String(partnerId.value || '') } });
}

function closeOngoingPrompt() {
  showOngoingPrompt.value = false;
}

async function initializeCallPage() {
  callTerminated.value = false;
  allowLeaveAfterEnd.value = false;
  connectedAtMs.value = null;
  durationSeconds.value = 0;
  endedDurationSeconds.value = 0;

  const parsedMode = String(route.query.mode || 'audio').toLowerCase();
  callMode.value = parsedMode === 'video' ? 'video' : 'audio';
  const parsedCallId = Number(route.query.callId);
  callId.value = Number.isInteger(parsedCallId) && parsedCallId > 0 ? parsedCallId : null;

  if (!Number.isInteger(partnerId.value) || partnerId.value <= 0) {
    feedback.value = 'Invalid call target.';
    return;
  }

  await loadPartnerInfo();
  ensureClientRealtimeStream();
  unsubscribeCall = subscribeClientRealtime('chat-call', (rawEvent) => {
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
  document.body.style.overflow = 'hidden';
  initializeCallPage();
  window.addEventListener('resize', handleViewportResize);
  window.visualViewport?.addEventListener?.('resize', handleViewportResize);
});

watch(showVideoStreams, (visible) => {
  if (visible) {
    schedulePreviewFit(false);
  }
});

onBeforeRouteLeave(() => {
  if (isCallOngoing.value) {
    showOngoingPrompt.value = true;
    return false;
  }

  return true;
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
  clearEndRedirectTimer();
  stopDurationTicker();
  document.body.style.overflow = '';
  window.removeEventListener('resize', handleViewportResize);
  window.visualViewport?.removeEventListener?.('resize', handleViewportResize);
  cleanupConnection();
});
</script>

<template>
  <section class="call-page">
    <header class="call-header">
      <button type="button" class="back-btn" @click="goBack">Back</button>
      <div class="title-wrap">
        <p class="kicker">{{ callModeLabel() }}</p>
        <h1>{{ partner?.name || 'Admin' }}</h1>
        <p class="status">{{ callStatus }}</p>
      </div>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div ref="stageRef" class="video-stage" :class="{ audio: callMode === 'audio' }">
      <video v-show="showVideoStreams" ref="remoteVideoRef" autoplay playsinline class="remote-video" />
      <div
        ref="localPreviewRef"
        class="local-preview"
        :class="{ hidden: !showVideoStreams, dragging: isDraggingPreview }"
        :style="localPreviewStyle"
        @pointerdown="onPreviewPointerDown"
        @pointermove="onPreviewPointerMove"
        @pointerup="stopPreviewDragging"
        @pointercancel="stopPreviewDragging"
      >
        <video ref="localVideoRef" autoplay playsinline muted class="local-video" />
      </div>

      <div v-if="showWaitingCard" class="state-card waiting">
        <img
          v-if="partner?.profileImagePath"
          :src="toMediaUrl(partner.profileImagePath)"
          :alt="partner?.name || 'Admin'"
          class="state-avatar"
        />
        <div v-else class="state-avatar placeholder">
          {{ (partner?.name || 'T').slice(0, 1).toUpperCase() }}
        </div>
        <p class="state-name">{{ partner?.name || 'Admin' }}</p>
        <p class="state-subtitle">{{ waitingStatusLabel }}</p>
      </div>

      <div v-if="showEndedCard" class="state-card ended">
        <img
          v-if="partner?.profileImagePath"
          :src="toMediaUrl(partner.profileImagePath)"
          :alt="partner?.name || 'Admin'"
          class="state-avatar"
        />
        <div v-else class="state-avatar placeholder">
          {{ (partner?.name || 'T').slice(0, 1).toUpperCase() }}
        </div>
        <p class="state-kicker">{{ callModeLabel() }}</p>
        <p class="state-name">{{ partner?.name || 'Admin' }}</p>
        <p class="state-subtitle">{{ callStatus }}</p>
        <p class="state-duration">Duration {{ endedDurationLabel }}</p>
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

    <div v-if="showOngoingPrompt" class="ongoing-modal" @click.self="closeOngoingPrompt">
      <div class="ongoing-card" role="dialog" aria-modal="true" aria-label="Call still ongoing">
        <h2>Call still ongoing</h2>
        <p>The call is active. End the call first before leaving this page.</p>
        <button type="button" class="ongoing-btn" @click="closeOngoingPrompt">Continue Call</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.call-page {
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: radial-gradient(circle at 15% 20%, #223956 0%, #0f1825 58%, #0a111a 100%);
  padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
  color: #eef6ff;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 0;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.call-header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.95rem 0.95rem 0.55rem;
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
  padding: 0 0.95rem 0.45rem;
  color: #ffb8c5;
}

.video-stage {
  position: relative;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  min-height: 0;
  background: #08131f;
  display: grid;
}

.remote-video {
  width: 100%;
  height: 100%;
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

.state-card {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.65rem;
  text-align: center;
  padding: 1.1rem;
  background: radial-gradient(circle at 50% 10%, rgba(39, 64, 96, 0.95) 0%, rgba(13, 24, 37, 0.96) 72%, rgba(10, 16, 24, 0.98) 100%);
}

.state-card.ended {
  background: radial-gradient(circle at 50% 0%, rgba(41, 64, 92, 0.96) 0%, rgba(12, 21, 34, 0.98) 68%, rgba(8, 14, 22, 1) 100%);
}

.state-avatar {
  width: clamp(96px, 18vw, 148px);
  height: clamp(96px, 18vw, 148px);
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(147, 178, 255, 0.56);
  box-shadow: 0 10px 26px rgba(5, 12, 22, 0.48);
}

.state-avatar.placeholder {
  display: grid;
  place-items: center;
  background: #263548;
  color: #eef4ff;
  font-size: 1.45rem;
  font-weight: 800;
}

.state-kicker,
.state-name,
.state-subtitle,
.state-duration {
  margin: 0;
}

.state-kicker {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #a2c8ff;
}

.state-name {
  color: #eef5ff;
  font-size: clamp(1.2rem, 4.4vw, 1.9rem);
  font-weight: 800;
}

.state-subtitle {
  color: #c8dcfc;
  font-size: clamp(0.95rem, 3.1vw, 1.2rem);
}

.state-duration {
  color: #dbe8ff;
  font-size: clamp(0.95rem, 3.1vw, 1.14rem);
  font-weight: 700;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 0.72rem;
  padding: 0.7rem 0.95rem calc(env(safe-area-inset-bottom, 0px) + 0.7rem);
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

.ongoing-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  background: rgba(2, 8, 16, 0.64);
  padding: 1rem;
}

.ongoing-card {
  width: min(380px, 100%);
  border: 1px solid rgba(136, 173, 225, 0.48);
  border-radius: 14px;
  background: #142437;
  padding: 1rem;
  box-shadow: 0 16px 40px rgba(1, 8, 16, 0.52);
}

.ongoing-card h2,
.ongoing-card p {
  margin: 0;
}

.ongoing-card p {
  margin-top: 0.45rem;
  color: #c7dbfb;
}

.ongoing-btn {
  margin-top: 0.85rem;
  border: 1px solid rgba(148, 186, 239, 0.5);
  border-radius: 10px;
  background: #1d3550;
  color: #eef5ff;
  padding: 0.45rem 0.75rem;
  font-weight: 700;
}

@media (max-width: 860px) {
  .call-page {
    height: 100%;
    width: 100%;
    padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
  }

  .call-header {
    padding: 0.7rem 0.7rem 0.45rem;
  }

  .feedback {
    padding: 0 0.7rem 0.35rem;
  }

  .controls {
    padding: 0.6rem 0.7rem calc(env(safe-area-inset-bottom, 0px) + 0.6rem);
  }

  .local-preview {
    width: 36%;
  }
}
</style>

