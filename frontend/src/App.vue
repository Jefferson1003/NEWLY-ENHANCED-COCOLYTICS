<script setup>
import { onMounted } from 'vue';
import AppToaster from './components/AppToaster.vue';
import { toastError } from './services/toast';

const FORCED_LOGOUT_MESSAGE_KEY = 'cocolytics_forced_logout_message';

onMounted(() => {
  const forcedMessage = sessionStorage.getItem(FORCED_LOGOUT_MESSAGE_KEY);
  if (!forcedMessage) return;

  sessionStorage.removeItem(FORCED_LOGOUT_MESSAGE_KEY);
  toastError(forcedMessage, 'Forced Logout', 5000);
});
</script>

<template>
  <router-view />
  <AppToaster />
</template>
