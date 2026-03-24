<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchPublicMarketplaceTraderDetail } from '../../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const trader = ref(null);

function toImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${FILE_BASE_URL}${path}`;
}

async function loadTrader() {
  const traderId = Number(route.params.id);
  if (!Number.isInteger(traderId) || traderId <= 0) {
    error.value = 'Invalid trader ID.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const data = await fetchPublicMarketplaceTraderDetail(traderId);
    trader.value = data.trader || null;

    if (!trader.value) {
      error.value = 'Trader not found.';
    }
  } catch (loadError) {
    error.value = loadError.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadTrader);
</script>

<template>
  <section class="page">
    <button type="button" class="back-btn" @click="router.push('/')">Back to Home</button>

    <p v-if="loading" class="muted">Loading trader profile...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <article v-else-if="trader" class="trader-panel">
      <div class="trader-head">
        <img
          v-if="trader.profileImagePath"
          :src="toImageUrl(trader.profileImagePath)"
          :alt="`${trader.name} profile`"
          class="avatar"
        />
        <div>
          <p class="kicker">Trader Profile</p>
          <h1>{{ trader.name || 'Trader' }}</h1>
          <p class="meta">Trader Number: {{ trader.traderNumber || trader.traderId }}</p>
          <p class="meta">Contact Number: {{ trader.contactNumber || 'N/A' }}</p>
        </div>
      </div>

      <p class="description">{{ trader.description || 'No description yet.' }}</p>

      <div class="stats">
        <article class="stat-card">
          <p class="label">Number of Products</p>
          <h2>{{ trader.totalProducts }}</h2>
        </article>
        <article class="stat-card">
          <p class="label">Total Stocks</p>
          <h2>{{ trader.totalStocks }}</h2>
        </article>
      </div>

      <p class="meta">Business Address: {{ trader.businessAddress || 'N/A' }}</p>

      <section class="products">
        <h3>Products</h3>
        <p v-if="!(trader.products || []).length" class="muted">No products listed yet.</p>
        <div v-else class="product-grid">
          <article v-for="product in trader.products" :key="product.id" class="product-card">
            <img
              v-if="product.productImagePath"
              :src="toImageUrl(product.productImagePath)"
              :alt="product.productName"
              class="product-image"
            />
            <h4>{{ product.productName }}</h4>
            <p>Size: {{ product.size }}</p>
            <p>Length: {{ product.lengthCm ?? 'N/A' }} cm</p>
            <p>Stock: {{ product.stockQuantity }}</p>
          </article>
        </div>
      </section>
    </article>
  </section>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 1rem;
  color: #ecfff4;
}

.back-btn {
  border: 1px solid rgba(131, 235, 198, 0.4);
  border-radius: 10px;
  background: rgba(8, 42, 54, 0.8);
  color: #eafff4;
  padding: 0.55rem 0.76rem;
  font-weight: 700;
}

.trader-panel {
  margin-top: 0.9rem;
  border: 1px solid rgba(108, 212, 175, 0.35);
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(7, 34, 45, 0.9), rgba(9, 54, 67, 0.72));
  padding: 1rem;
}

.trader-head {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: center;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(134, 238, 200, 0.5);
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #92f5cd;
}

h1 {
  margin: 0.4rem 0 0;
  font-size: 1.35rem;
}

.meta {
  margin: 0.3rem 0 0;
  color: #c9fce8;
}

.description {
  margin: 0.85rem 0 0;
  color: #dcfff1;
}

.stats {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.stat-card {
  border: 1px solid rgba(117, 223, 185, 0.32);
  border-radius: 12px;
  background: rgba(6, 30, 40, 0.72);
  padding: 0.65rem;
}

.label {
  margin: 0;
  font-size: 0.76rem;
  color: #b8f6df;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

h2 {
  margin: 0.35rem 0 0;
}

.products {
  margin-top: 1rem;
}

.products h3 {
  margin: 0;
}

.product-grid {
  margin-top: 0.65rem;
  display: grid;
  gap: 0.6rem;
}

.product-card {
  border: 1px solid rgba(116, 221, 184, 0.28);
  border-radius: 12px;
  background: rgba(8, 34, 44, 0.72);
  padding: 0.65rem;
}

.product-image {
  width: 100%;
  height: 130px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(127, 230, 193, 0.35);
}

h4 {
  margin: 0.5rem 0 0;
}

.product-card p {
  margin: 0.25rem 0 0;
  color: #cefde9;
}

.muted,
.error {
  margin-top: 0.9rem;
}

.muted {
  color: #c4f8e3;
}

.error {
  color: #ffbfca;
}

@media (min-width: 760px) {
  .page {
    padding: 1.2rem;
  }

  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
