<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchMyOrders, fetchTraderProducts, fetchTraderProfile } from '../../services/api';

const profile = ref(null);
const feedback = ref('');
const loading = ref(false);
const products = ref([]);
const orders = ref([]);

const completedStatuses = new Set(['completed', 'delivered', 'fulfilled']);
const openStatuses = new Set(['pending', 'processing', 'confirmed', 'to_ship', 'shipping', 'out_for_delivery']);

const totalProducts = computed(() => products.value.length);

const totalStocks = computed(() => {
  return products.value.reduce((sum, product) => sum + Number(product.stockQuantity || 0), 0);
});

const lowStockCount = computed(() => {
  return products.value.filter((product) => Number(product.stockQuantity || 0) < 20).length;
});

const outOfStockCount = computed(() => {
  return products.value.filter((product) => Number(product.stockQuantity || 0) <= 0).length;
});

const completedOrders = computed(() => {
  return orders.value.filter((order) => completedStatuses.has(String(order.status || '').toLowerCase())).length;
});

const openOrders = computed(() => {
  return orders.value.filter((order) => openStatuses.has(String(order.status || '').toLowerCase())).length;
});

const totalSoldUnits = computed(() => {
  return orders.value
    .filter((order) => completedStatuses.has(String(order.status || '').toLowerCase()))
    .reduce((sum, order) => {
      const units = (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0);
      return sum + units;
    }, 0);
});

const stockHealth = computed(() => {
  if (!products.value.length) return 0;
  const safeCount = products.value.filter((product) => Number(product.stockQuantity || 0) >= 20).length;
  return Math.round((safeCount / products.value.length) * 100);
});

const statusSummary = computed(() => {
  const map = new Map();

  for (const order of orders.value) {
    const key = String(order.status || 'unknown').trim().toLowerCase() || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([status, count]) => ({
      status,
      label: status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      count,
    }))
    .sort((a, b) => b.count - a.count);
});

async function loadProfile() {
  try {
    const data = await fetchTraderProfile();
    profile.value = data.user;
  } catch (error) {
    feedback.value = error.message;
  }
}

async function loadDashboard() {
  loading.value = true;
  feedback.value = '';

  try {
    const [profileData, productsData, ordersData] = await Promise.all([
      fetchTraderProfile(),
      fetchTraderProducts(),
      fetchMyOrders(),
    ]);

    profile.value = profileData.user;
    products.value = productsData.products || [];
    orders.value = ordersData.orders || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Trader Dashboard</p>
      <h1>Welcome Trader</h1>
      <p class="email">{{ profile?.email }}</p>
    </header>

    <p v-if="loading" class="muted">Loading trader analytics...</p>

    <section v-else class="stats-grid">
      <article class="stat-card">
        <p class="stat-label">Total Products</p>
        <p class="stat-value">{{ totalProducts }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Total Sold Units</p>
        <p class="stat-value">{{ totalSoldUnits }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Open Orders</p>
        <p class="stat-value">{{ openOrders }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Completed Orders</p>
        <p class="stat-value">{{ completedOrders }}</p>
      </article>

      <article class="stat-card">
        <p class="stat-label">Total Inventory Stocks</p>
        <p class="stat-value">{{ totalStocks }}</p>
      </article>

      <article class="stat-card" :class="{ warning: lowStockCount > 0 || outOfStockCount > 0 }">
        <p class="stat-label">Low and Out of Stock</p>
        <p class="stat-value">{{ lowStockCount }} / {{ outOfStockCount }}</p>
      </article>
    </section>

    <article v-if="!loading" class="panel">
      <header class="panel-head">
        <h2>Inventory Health</h2>
        <span class="chip">{{ stockHealth }}% healthy</span>
      </header>
      <div class="meter-track" role="img" aria-label="Inventory health indicator">
        <div class="meter-fill" :style="{ width: `${stockHealth}%` }"></div>
      </div>
      <p class="muted-line">Healthy products are those with stock of 20 and above.</p>
    </article>

    <article v-if="!loading" class="panel">
      <h2>Order Analytics</h2>
      <p v-if="!statusSummary.length" class="muted-line">No order history yet.</p>
      <ul v-else class="status-list">
        <li v-for="item in statusSummary" :key="item.status">
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
        </li>
      </ul>
    </article>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.page {
  color: #effff7;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #9cf5cd;
}

h1 {
  margin: 0.45rem 0 0;
  font-size: 1.45rem;
}

.email {
  margin: 0.4rem 0 0;
  color: #c2f7e0;
}

.muted {
  margin-top: 1rem;
  color: #c8fce6;
}

.stats-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.62rem;
}

.stat-card {
  border: 1px solid rgba(113, 215, 177, 0.34);
  border-radius: 14px;
  padding: 0.78rem 0.82rem;
  background: linear-gradient(150deg, rgba(7, 40, 53, 0.88), rgba(10, 61, 76, 0.7));
}

.stat-card.warning {
  border-color: rgba(255, 195, 136, 0.55);
  background: linear-gradient(150deg, rgba(57, 35, 16, 0.82), rgba(90, 55, 23, 0.72));
}

.stat-label {
  margin: 0;
  color: #c9fce6;
  font-size: 0.82rem;
}

.stat-value {
  margin: 0.32rem 0 0;
  color: #effff7;
  font-size: 1.45rem;
  line-height: 1;
  font-weight: 900;
}

.panel {
  margin-top: 0.85rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 0.85rem;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

h2 {
  margin: 0;
  font-size: 1rem;
}

.chip {
  border: 1px solid rgba(131, 236, 200, 0.48);
  border-radius: 999px;
  padding: 0.16rem 0.52rem;
  font-size: 0.73rem;
  color: #dffff2;
}

.meter-track {
  margin-top: 0.72rem;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: rgba(3, 19, 26, 0.9);
  border: 1px solid rgba(110, 209, 174, 0.26);
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1da879, #4fd7a9);
}

.muted-line {
  margin: 0.62rem 0 0;
  color: #c8fce6;
  font-size: 0.83rem;
}

.status-list {
  margin: 0.66rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;
}

.status-list li {
  border: 1px solid rgba(114, 217, 180, 0.28);
  border-radius: 10px;
  background: rgba(6, 33, 44, 0.64);
  padding: 0.5rem 0.62rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  color: #e7fff4;
  font-size: 0.85rem;
}

.status-list strong {
  font-size: 0.92rem;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffbfca;
}

@media (min-width: 760px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
