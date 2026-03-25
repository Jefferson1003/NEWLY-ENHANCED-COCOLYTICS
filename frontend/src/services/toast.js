import { reactive } from 'vue';

const DEFAULT_DURATION = 2000;
const state = reactive({
  items: [],
});

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeType(type) {
  if (type === 'success' || type === 'error' || type === 'info' || type === 'warning') {
    return type;
  }

  return 'info';
}

export function dismissToast(id) {
  state.items = state.items.filter((item) => item.id !== id);
}

export function pushToast({
  type = 'info',
  title = '',
  message = '',
  duration = DEFAULT_DURATION,
} = {}) {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) return;

  const toast = {
    id: nextId(),
    type: normalizeType(type),
    title: String(title || '').trim(),
    message: normalizedMessage,
  };

  state.items = [...state.items, toast];

  if (duration > 0) {
    window.setTimeout(() => {
      dismissToast(toast.id);
    }, duration);
  }
}

export function toastSuccess(message, title = 'Success') {
  pushToast({ type: 'success', title, message });
}

export function toastError(message, title = 'Error') {
  pushToast({ type: 'error', title, message });
}

export function toastInfo(message, title = 'Info') {
  pushToast({ type: 'info', title, message });
}

export function toastWarning(message, title = 'Warning') {
  pushToast({ type: 'warning', title, message });
}

export function useToaster() {
  return {
    toasts: state,
    dismissToast,
  };
}
