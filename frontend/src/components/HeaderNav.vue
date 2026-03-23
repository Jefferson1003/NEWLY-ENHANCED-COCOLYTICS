<template>
  <header class="header-nav">
    <div class="brand-block">
      <p class="brand-kicker">Cocolytics</p>
      <strong class="brand-name">Mobile Insights Hub</strong>
    </div>

    <button type="button" class="login-btn" @click="emit('open-auth')">Login</button>
  </header>
</template>

<script setup>
const emit = defineEmits(['open-auth'])
</script>

<style scoped>
.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: #081820;
  border-bottom: 1px solid rgba(65, 160, 135, 0.35);
  box-shadow: 0 10px 24px rgba(4, 13, 17, 0.55);
}

.brand-block {
  display: grid;
  gap: 0.1rem;
}

.brand-kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.66rem;
  color: #80dbb8;
}

.brand-name {
  color: #f4fff7;
  font-size: 1rem;
}

.login-btn {
  border: 1px solid rgba(121, 224, 188, 0.5);
  background: #13544a;
  color: #ecfff5;
  font-weight: 700;
  border-radius: 8px;
  padding: 0.45rem 0.8rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(19, 84, 74, 0.4);
}
</style>
