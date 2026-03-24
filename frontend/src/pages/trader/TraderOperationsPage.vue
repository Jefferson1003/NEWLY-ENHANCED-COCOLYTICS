<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchMyOrders, fetchTraderPaperUploads, fetchTraderProducts } from '../../services/api';

const activeFilter = ref('scanner');
const loading = ref(false);
const feedback = ref('');
const products = ref([]);
const orders = ref([]);
const paperUploads = ref([]);

const scannerItems = computed(() => {
  return paperUploads.value
    .filter((item) => item.paperType === 'to_cut')
    .map((item) => ({
      id: item.id,
      code: `SCAN-${String(item.id).padStart(5, '0')}`,
      productName: item.title,
      scannedAt: item.createdAt,
      operator: 'Trader Upload',
      status: item.status,
    }));
});

const dispatchItems = computed(() => {
  return orders.value.map((item) => ({
    id: item.id,
    ticket: `DSP-${String(item.id).padStart(5, '0')}`,
    destination: item.deliveryCity || item.deliveryFullAddress || '-',
    truckPlate: 'N/A',
    schedule: item.createdAt,
    status: item.status || 'pending',
  }));
});

const reportItems = computed(() => {
  const pendingDispatch = dispatchItems.value.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    return status !== 'completed' && status !== 'delivered' && status !== 'cancelled';
  }).length;

  const verificationIssues = scannerItems.value.filter((item) => String(item.status || '').toLowerCase() === 'rejected').length;

  return [
    { id: 21, label: 'Total Products', value: products.value.length },
    { id: 22, label: 'Scanned To Cut Files', value: scannerItems.value.length },
    { id: 23, label: 'Dispatch Records', value: dispatchItems.value.length },
    { id: 24, label: 'Pending Dispatch', value: pendingDispatch },
    { id: 25, label: 'Verification Issues', value: verificationIssues },
  ];
});

const statusClasses = {
  verified: 'ok',
  delivered: 'ok',
  pending: 'warn',
  scheduled: 'warn',
  loading: 'warn',
};

const filterLabel = computed(() => {
  if (activeFilter.value === 'scanner') return 'Scanner';
  if (activeFilter.value === 'dispatch') return 'Dispatch';
  return 'Reports';
});

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function classForStatus(status) {
  return statusClasses[status] || 'neutral';
}

async function loadOperationsData() {
  loading.value = true;
  feedback.value = '';
  try {
    const [productsData, ordersData, papersData] = await Promise.all([
      fetchTraderProducts(),
      fetchMyOrders(),
      fetchTraderPaperUploads(),
    ]);

    products.value = productsData.products || [];
    orders.value = ordersData.orders || [];
    paperUploads.value = papersData.uploads || [];
  } catch (error) {
    feedback.value = error.message || 'Could not load operations data.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadOperationsData);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Operations</p>
      <h1>Operations Hub</h1>
      <p class="sub">Track scanner flow, dispatch queue, and reports in one page.</p>
    </header>

    <nav class="filters">
      <button type="button" :class="{ active: activeFilter === 'scanner' }" @click="activeFilter = 'scanner'">Scanner</button>
      <button type="button" :class="{ active: activeFilter === 'dispatch' }" @click="activeFilter = 'dispatch'">Dispatch</button>
      <button type="button" :class="{ active: activeFilter === 'reports' }" @click="activeFilter = 'reports'">Reports</button>
    </nav>

    <section class="panel">
      <h2>{{ filterLabel }}</h2>
      <p v-if="feedback" class="feedback">{{ feedback }}</p>
      <p v-if="loading" class="muted">Loading operations data...</p>

      <div v-if="!loading && activeFilter === 'scanner'" class="cards-grid">
        <article v-for="item in scannerItems" :key="item.id" class="operation-card">
          <header class="card-head">
            <h3>{{ item.code }}</h3>
            <span :class="['badge', classForStatus(item.status)]">{{ item.status }}</span>
          </header>
          <p class="line">Product: {{ item.productName }}</p>
          <p class="line">Scanned At: {{ formatDate(item.scannedAt) }}</p>
          <p class="line">Operator: {{ item.operator }}</p>
        </article>
        <p v-if="!scannerItems.length" class="muted">No scanner records found.</p>
      </div>

      <div v-else-if="!loading && activeFilter === 'dispatch'" class="cards-grid">
        <article v-for="item in dispatchItems" :key="item.id" class="operation-card">
          <header class="card-head">
            <h3>{{ item.ticket }}</h3>
            <span :class="['badge', classForStatus(item.status)]">{{ item.status }}</span>
          </header>
          <p class="line">Destination: {{ item.destination }}</p>
          <p class="line">Truck Plate: {{ item.truckPlate }}</p>
          <p class="line">Schedule: {{ formatDate(item.schedule) }}</p>
        </article>
        <p v-if="!dispatchItems.length" class="muted">No dispatch records found.</p>
      </div>

      <div v-else-if="!loading" class="reports-grid">
        <article v-for="item in reportItems" :key="item.id" class="report-card">
          <p class="report-label">{{ item.label }}</p>
          <p class="report-value">{{ item.value }}</p>
        </article>
      </div>
    </section>
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

.head h1 {
  margin: 0.45rem 0 0;
}

.sub {
  margin: 0.35rem 0 0;
  color: #c8fce6;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.filters button {
  border: 1px solid rgba(126, 223, 192, 0.35);
  border-radius: 10px;
  background: rgba(8, 44, 57, 0.85);
  color: #dffef2;
  padding: 0.5rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.filters button.active {
  background: #eaf6ef;
  color: #346f60;
}

.panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
}

.panel h2 {
  margin: 0;
}

.feedback {
  margin: 0.7rem 0 0;
  color: #ffd4dc;
}

.muted {
  margin: 0.75rem 0 0;
  color: #c2f7e0;
}

.cards-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.operation-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.65);
  padding: 0.7rem;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.card-head h3 {
  margin: 0;
  font-size: 0.95rem;
}

.line {
  margin: 0.35rem 0 0;
  color: #d2ffef;
  font-size: 0.84rem;
}

.badge {
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  border: 1px solid rgba(137, 224, 197, 0.45);
}

.badge.ok {
  background: rgba(25, 123, 87, 0.86);
  color: #dcffee;
}

.badge.warn {
  background: rgba(163, 104, 34, 0.86);
  border-color: rgba(255, 196, 122, 0.5);
  color: #fff2df;
}

.badge.neutral {
  background: rgba(45, 97, 131, 0.85);
  color: #e7f6ff;
}

.reports-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.report-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.65);
  padding: 0.7rem;
}

.report-label {
  margin: 0;
  color: #c7f8e3;
  font-size: 0.82rem;
}

.report-value {
  margin: 0.42rem 0 0;
  font-size: 1.4rem;
  font-weight: 900;
  color: #effff7;
}

@media (max-width: 620px) {
  .cards-grid,
  .reports-grid {
    grid-template-columns: 1fr;
  }
}
</style>
