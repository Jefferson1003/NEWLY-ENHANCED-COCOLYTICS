<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Please Confirm',
  },
  message: {
    type: String,
    default: 'Are you sure you want to continue?',
  },
  confirmLabel: {
    type: String,
    default: 'Confirm',
  },
  cancelLabel: {
    type: String,
    default: 'Cancel',
  },
  danger: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div v-if="visible" class="modal-wrap" @click.self="emit('cancel')">
    <article class="modal-card">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="actions">
        <button type="button" class="cancel" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button type="button" :class="['confirm', { danger } ]" @click="emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.6);
}

.modal-card {
  width: min(100%, 380px);
  border-radius: 14px;
  border: 1px solid rgba(142, 214, 255, 0.3);
  background: linear-gradient(165deg, rgba(11, 36, 51, 0.95), rgba(10, 45, 66, 0.9));
  padding: 1rem;
  color: #e8f4ff;
}

h3 {
  margin: 0;
  font-size: 1.05rem;
}

p {
  margin: 0.6rem 0 0;
  color: #cce6fb;
  font-size: 0.88rem;
}

.actions {
  margin-top: 0.9rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}

button {
  border: 1px solid rgba(136, 208, 255, 0.36);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.cancel {
  background: rgba(13, 45, 64, 0.85);
  color: #e8f4ff;
}

.confirm {
  background: rgba(28, 86, 132, 0.88);
  color: #eff8ff;
}

.confirm.danger {
  border-color: rgba(255, 143, 156, 0.45);
  background: rgba(164, 34, 54, 0.95);
  color: #ffe9ed;
}
</style>
