<template>
  <footer id="contact" class="footer-section">
    <p class="footer-brand">Cocolytics</p>
    <p class="footer-text">Mobile-first intelligence for product teams, operations, and founders.</p>
    <div class="footer-meta">
      <span>support@cocolytics.app</span>
      <span>{{ currentYear }} Cocolytics Labs</span>
    </div>
  </footer>
</template>

<script setup>
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.footer-section {
  margin-top: 0;
  border-top: 1px solid rgba(77, 164, 136, 0.32);
  padding: 1rem;
  background: rgba(9, 29, 36, 0.88);
}

.footer-brand {
  margin: 0;
  font-weight: 800;
  font-size: 1.15rem;
  color: #eefff6;
}

.footer-text {
  margin: 0.4rem 0 0;
  color: #c5f8e2;
  font-size: 0.9rem;
}

.footer-meta {
  margin-top: 0.95rem;
  display: grid;
  gap: 0.3rem;
  color: #98ddc1;
  font-size: 0.78rem;
}

@media (min-width: 720px) {
  .footer-meta {
    grid-template-columns: 1fr auto;
  }
}
</style>
