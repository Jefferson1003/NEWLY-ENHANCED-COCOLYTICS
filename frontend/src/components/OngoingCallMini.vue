<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import {
  clearOngoingCallSession,
  getOngoingCallState,
  setOngoingCallDragPosition,
  setOngoingCallMinimized,
} from '../services/ongoingCall';

const props = defineProps({
  role: {
    type: String,
    required: true,
  },
});

const state = getOngoingCallState();
const remoteVideoRef = ref(null);
const localVideoRef = ref(null);
const panelRef = ref(null);
const isDragging = ref(false);

const dragState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
};

const visible = computed(() => {
  const role = String(props.role || '').trim().toLowerCase();
  return state.active && state.minimized && state.role === role;
});

const wrapperStyle = computed(() => ({
  right: `${Math.max(12, state.dragX)}px`,
  bottom: `${Math.max(12, state.dragY)}px`,
}));

function modeLabel() {
  return state.mode === 'video' ? 'Video Call' : 'Voice Call';
}

function bindStreams() {
  if (remoteVideoRef.value) {
    remoteVideoRef.value.srcObject = state.remoteStream || null;
  }

  if (localVideoRef.value) {
    localVideoRef.value.srcObject = state.localStream || null;
  }
}

watch(
  () => [visible.value, state.remoteStream, state.localStream],
  async () => {
    await nextTick();
    bindStreams();
  },
  { immediate: true }
);

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  isDragging.value = true;
  dragState.pointerId = event.pointerId;
  dragState.startX = Number(event.clientX || 0);
  dragState.startY = Number(event.clientY || 0);
  dragState.originX = Number(state.dragX || 16);
  dragState.originY = Number(state.dragY || 16);
  event.currentTarget?.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!isDragging.value || dragState.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = Number(event.clientX || 0) - dragState.startX;
  const deltaY = Number(event.clientY || 0) - dragState.startY;
  setOngoingCallDragPosition(dragState.originX - deltaX, dragState.originY - deltaY);
}

function stopDragging() {
  isDragging.value = false;
  dragState.pointerId = null;
}

async function endCallFromMini() {
  if (typeof state.endCall === 'function') {
    try {
      await state.endCall();
    } catch {
      // End callback failure should still clear stale mini state.
    }
  }

  clearOngoingCallSession();
}

function restoreFull() {
  if (typeof state.openCall === 'function') {
    state.openCall();
    return;
  }

  setOngoingCallMinimized(false);
}
</script>

<template>
  <section
    v-if="visible"
    ref="panelRef"
    :class="['mini-call', { dragging: isDragging }]"
    :style="wrapperStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="stopDragging"
    @pointercancel="stopDragging"
  >
    <header class="mini-head">
      <p>{{ state.partnerName || 'Call in progress' }}</p>
      <small>{{ modeLabel() }}</small>
    </header>

    <div class="mini-stage">
      <video ref="remoteVideoRef" autoplay playsinline class="mini-remote" />
      <video ref="localVideoRef" autoplay muted playsinline class="mini-local" />
    </div>

    <div class="mini-actions">
      <button type="button" class="mini-btn" @click.stop="restoreFull">Open</button>
      <button type="button" class="mini-btn end" @click.stop="endCallFromMini">End</button>
    </div>
  </section>
</template>

<style scoped>
.mini-call {
  position: fixed;
  z-index: 140;
  width: min(250px, calc(100vw - 1.5rem));
  border: 1px solid rgba(148, 178, 230, 0.48);
  border-radius: 14px;
  background: rgba(10, 22, 34, 0.96);
  box-shadow: 0 14px 36px rgba(2, 8, 16, 0.56);
  overflow: hidden;
  touch-action: none;
  cursor: grab;
}

.mini-call.dragging {
  cursor: grabbing;
}

.mini-head {
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid rgba(148, 178, 230, 0.28);
}

.mini-head p,
.mini-head small {
  margin: 0;
}

.mini-head p {
  color: #eef5ff;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-head small {
  color: #b6cae9;
  font-size: 0.66rem;
}

.mini-stage {
  position: relative;
  aspect-ratio: 16 / 10;
  background: #0b1420;
}

.mini-remote {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #07121d;
}

.mini-local {
  position: absolute;
  width: 30%;
  min-width: 62px;
  right: 8px;
  bottom: 8px;
  border-radius: 8px;
  border: 1px solid rgba(164, 189, 229, 0.46);
  object-fit: cover;
  background: #132033;
}

.mini-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
  padding: 0.42rem 0.55rem 0.52rem;
}

.mini-btn {
  border: 1px solid rgba(151, 186, 236, 0.5);
  border-radius: 8px;
  background: #1f3753;
  color: #edf5ff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.28rem 0.58rem;
}

.mini-btn.end {
  border-color: rgba(255, 138, 160, 0.54);
  background: #742f3b;
}
</style>
