import { reactive } from 'vue';

const state = reactive({
  active: false,
  minimized: false,
  role: '',
  partnerId: null,
  partnerName: '',
  mode: 'audio',
  localStream: null,
  remoteStream: null,
  dragX: 16,
  dragY: 16,
  openCall: null,
  endCall: null,
});

export function getOngoingCallState() {
  return state;
}

export function setOngoingCallSession(payload = {}) {
  state.active = Boolean(payload.active);
  state.minimized = Boolean(payload.minimized);
  state.role = String(payload.role || '').trim().toLowerCase();
  state.partnerId = Number.isInteger(Number(payload.partnerId)) ? Number(payload.partnerId) : null;
  state.partnerName = String(payload.partnerName || '').trim();
  state.mode = String(payload.mode || 'audio').toLowerCase() === 'video' ? 'video' : 'audio';

  if (payload.localStream !== undefined) {
    state.localStream = payload.localStream || null;
  }

  if (payload.remoteStream !== undefined) {
    state.remoteStream = payload.remoteStream || null;
  }

  if (payload.endCall !== undefined) {
    state.endCall = typeof payload.endCall === 'function' ? payload.endCall : null;
  }

  if (payload.openCall !== undefined) {
    state.openCall = typeof payload.openCall === 'function' ? payload.openCall : null;
  }
}

export function setOngoingCallMinimized(minimized) {
  state.minimized = Boolean(minimized);
}

export function setOngoingCallDragPosition(x, y) {
  state.dragX = Math.max(12, Number(x || 0));
  state.dragY = Math.max(12, Number(y || 0));
}

export function clearOngoingCallSession() {
  state.active = false;
  state.minimized = false;
  state.role = '';
  state.partnerId = null;
  state.partnerName = '';
  state.mode = 'audio';
  state.localStream = null;
  state.remoteStream = null;
  state.openCall = null;
  state.endCall = null;
}
