<script setup>
import { useToaster } from '../services/toast';

const { toasts, dismissToast } = useToaster();
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-atomic="true">
    <article
      v-for="toast in toasts.items"
      :key="toast.id"
      class="toast-item"
      :class="`is-${toast.type}`"
      role="status"
    >
      <div class="toast-copy">
        <p v-if="toast.title" class="toast-title">{{ toast.title }}</p>
        <p class="toast-message">{{ toast.message }}</p>
      </div>
      <button type="button" class="toast-close" @click="dismissToast(toast.id)">x</button>
    </article>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 0.85rem;
  right: 0.85rem;
  z-index: 1200;
  width: min(92vw, 360px);
  display: grid;
  gap: 0.5rem;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  border-radius: 12px;
  border: 1px solid rgba(137, 231, 198, 0.5);
  background: rgba(8, 41, 55, 0.96);
  color: #ebfff6;
  box-shadow: 0 10px 24px rgba(2, 9, 16, 0.45);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.55rem;
  padding: 0.6rem 0.65rem;
}

.toast-item.is-success {
  border-color: rgba(128, 236, 172, 0.7);
}

.toast-item.is-error {
  border-color: rgba(255, 138, 154, 0.72);
}

.toast-item.is-warning {
  border-color: rgba(255, 206, 142, 0.75);
}

.toast-copy {
  min-width: 0;
}

.toast-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
}

.toast-message {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  line-height: 1.25;
  word-wrap: break-word;
}

.toast-close {
  border: 1px solid rgba(127, 230, 191, 0.45);
  background: rgba(9, 56, 72, 0.88);
  color: #dffff2;
  border-radius: 8px;
  width: 26px;
  height: 24px;
  line-height: 1;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 520px) {
  .toast-stack {
    top: 0.62rem;
    right: 0.62rem;
    left: 0.62rem;
    width: auto;
  }
}
</style>
