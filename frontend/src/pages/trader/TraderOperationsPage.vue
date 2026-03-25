<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchTraderPaperUploads, fetchTraderProducts, fetchTraderSalesOrders } from '../../services/api';

const activeFilter = ref('scanner');
const loading = ref(false);
const feedback = ref('');
const products = ref([]);
const salesOrders = ref([]);
const paperUploads = ref([]);

const completedStatuses = new Set(['completed', 'delivered', 'fulfilled']);

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
  return salesOrders.value.map((item) => ({
    id: item.id,
    ticket: `DSP-${String(item.id).padStart(5, '0')}`,
    destination: item.deliveryCity || item.deliveryFullAddress || '-',
    truckPlate: 'N/A',
    schedule: item.createdAt,
    status: item.status || 'pending',
  }));
});

const totalOrders = computed(() => salesOrders.value.length);

const completedOrdersCount = computed(() => {
  return salesOrders.value.filter((order) => completedStatuses.has(String(order.status || '').toLowerCase())).length;
});

const totalItemsSold = computed(() => {
  return salesOrders.value.reduce((sum, order) => {
    return sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0);
  }, 0);
});

const pendingDispatchCount = computed(() => {
  return dispatchItems.value.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    return !completedStatuses.has(status) && status !== 'cancelled';
  }).length;
});

const totalRevenue = computed(() => {
  // Price is not stored in current schema, so revenue remains zero until pricing is added.
  return 0;
});

const verificationIssues = computed(() => {
  return scannerItems.value.filter((item) => String(item.status || '').toLowerCase() === 'rejected').length;
});

const averageRating = computed(() => {
  if (!totalOrders.value) return 0;
  const completionRate = completedOrdersCount.value / totalOrders.value;
  return Number((3 + completionRate * 2).toFixed(1));
});

const growthPercent = computed(() => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthSold = salesOrders.value
    .filter((order) => {
      const date = new Date(order.createdAt);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    })
    .reduce((sum, order) => sum + (order.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0), 0);

  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const previousMonthSold = salesOrders.value
    .filter((order) => {
      const date = new Date(order.createdAt);
      return date.getFullYear() === previousYear && date.getMonth() === previousMonth;
    })
    .reduce((sum, order) => sum + (order.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0), 0);

  if (previousMonthSold === 0) {
    return currentMonthSold > 0 ? 100 : 0;
  }

  return Number((((currentMonthSold - previousMonthSold) / previousMonthSold) * 100).toFixed(1));
});

const topProducts = computed(() => {
  const map = new Map();

  for (const order of salesOrders.value) {
    for (const item of order.items || []) {
      const key = `${item.productName || 'Product'}|${item.size || 'N/A'}`;
      map.set(key, (map.get(key) || 0) + Number(item.quantity || 0));
    }
  }

  return Array.from(map.entries())
    .map(([key, quantity]) => {
      const [productName, size] = key.split('|');
      return {
        productName,
        size,
        quantity,
      };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
});

const monthlyBreakdown = computed(() => {
  const rows = new Map();

  for (const order of salesOrders.value) {
    const date = new Date(order.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    if (!rows.has(key)) {
      rows.set(key, {
        key,
        label,
        orders: 0,
        itemsSold: 0,
        revenue: 0,
      });
    }

    const row = rows.get(key);
    row.orders += 1;
    row.itemsSold += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  return Array.from(rows.values())
    .sort((a, b) => b.key.localeCompare(a.key));
});

const yearlyBreakdown = computed(() => {
  const rows = new Map();

  for (const order of salesOrders.value) {
    const year = String(new Date(order.createdAt).getFullYear());

    if (!rows.has(year)) {
      rows.set(year, {
        year,
        orders: 0,
        itemsSold: 0,
        revenue: 0,
      });
    }

    const row = rows.get(year);
    row.orders += 1;
    row.itemsSold += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  return Array.from(rows.values())
    .sort((a, b) => b.year.localeCompare(a.year));
});

const reportCards = computed(() => {
  return [
    {
      id: 'total-sales',
      title: 'Total Sales',
      value: formatCurrency(totalRevenue.value),
      subtitle: 'Revenue from cocolumber sales',
      footerLeft: `Items: ${totalItemsSold.value}`,
      footerRight: `Avg: ${formatCurrency(totalItemsSold.value ? totalRevenue.value / totalItemsSold.value : 0)}`,
      accent: 'green',
      tag: 'live',
    },
    {
      id: 'items-sold',
      title: 'Items Sold',
      value: `${totalItemsSold.value} units`,
      subtitle: 'Total cocolumber quantity sold',
      footerLeft: `Top: ${topProducts.value[0]?.productName || '-'}`,
      footerRight: `${topProducts.value[0]?.quantity || 0} units`,
      accent: 'blue',
      tag: 'active',
    },
    {
      id: 'orders',
      title: 'Orders',
      value: `${totalOrders.value} orders`,
      subtitle: 'Total orders received',
      footerLeft: `Completed: ${completedOrdersCount.value}`,
      footerRight: `Pending: ${pendingDispatchCount.value}`,
      accent: 'purple',
      tag: 'live',
    },
    {
      id: 'rating',
      title: 'Rating',
      value: `${averageRating.value.toFixed(1)} ★`,
      subtitle: 'Performance score from completion rate',
      footerLeft: averageRating.value >= 4 ? 'Very good' : averageRating.value >= 3 ? 'Good' : 'Needs work',
      footerRight: '',
      accent: 'gold',
      tag: averageRating.value.toFixed(1),
    },
    {
      id: 'growth',
      title: 'Growth',
      value: `${growthPercent.value > 0 ? '+' : ''}${growthPercent.value}%`,
      subtitle: 'Month-over-month growth',
      footerLeft: `Last Month: ${monthlyBreakdown.value[1]?.itemsSold || 0} units`,
      footerRight: `This Month: ${monthlyBreakdown.value[0]?.itemsSold || 0} units`,
      accent: growthPercent.value >= 0 ? 'teal' : 'red',
      tag: `${growthPercent.value > 0 ? '+' : ''}${growthPercent.value}%`,
    },
  ];
});

const summaryStats = computed(() => {
  return [
    { id: 'sum-revenue', label: 'Total Revenue', value: formatCurrency(totalRevenue.value) },
    { id: 'sum-items', label: 'Total Items Sold', value: String(totalItemsSold.value) },
    { id: 'sum-orders', label: 'Total Orders', value: String(totalOrders.value) },
    { id: 'sum-rating', label: 'Average Rating', value: `${averageRating.value.toFixed(1)}/5.0` },
  ];
});

const statusClasses = {
  verified: 'ok',
  delivered: 'ok',
  approved: 'ok',
  pending: 'warn',
  scheduled: 'warn',
  loading: 'warn',
  to_ship: 'warn',
  cancelled: 'danger',
  rejected: 'danger',
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

function formatStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  return normalized.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

async function loadOperationsData() {
  loading.value = true;
  feedback.value = '';
  try {
    const [productsData, salesOrdersData, papersData] = await Promise.all([
      fetchTraderProducts(),
      fetchTraderSalesOrders(),
      fetchTraderPaperUploads(),
    ]);

    products.value = productsData.products || [];
    salesOrders.value = salesOrdersData.orders || [];
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
        <article v-for="card in reportCards" :key="card.id" :class="['metric-card', card.accent]">
          <header class="metric-head">
            <p>{{ card.title }}</p>
            <span class="metric-tag">{{ card.tag }}</span>
          </header>
          <p class="metric-value">{{ card.value }}</p>
          <p class="metric-sub">{{ card.subtitle }}</p>
          <div class="metric-divider"></div>
          <footer class="metric-foot">
            <span>{{ card.footerLeft }}</span>
            <span>{{ card.footerRight }}</span>
          </footer>
        </article>

        <article class="metric-card top-products">
          <header class="metric-head">
            <p>Top Products</p>
            <span class="metric-tag">Trending</span>
          </header>
          <p class="metric-sub">Your best selling grades</p>
          <div class="product-rank" v-for="row in topProducts.slice(0, 3)" :key="`${row.productName}-${row.size}`">
            <span>{{ row.productName }} ({{ row.size }})</span>
            <strong>{{ row.quantity }} units</strong>
          </div>
          <p v-if="!topProducts.length" class="muted">No sold products yet.</p>
        </article>
      </div>

      <section v-if="!loading && activeFilter === 'reports'" class="report-tables">
        <article class="table-block">
          <h3>Monthly Breakdown</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Orders</th>
                  <th>Items Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in monthlyBreakdown" :key="row.key">
                  <td>{{ row.label }}</td>
                  <td>{{ row.orders }}</td>
                  <td>{{ row.itemsSold }}</td>
                  <td>{{ formatCurrency(row.revenue) }}</td>
                </tr>
                <tr v-if="!monthlyBreakdown.length">
                  <td colspan="4">No monthly data yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="table-block">
          <h3>Yearly Breakdown</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Orders</th>
                  <th>Items Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in yearlyBreakdown" :key="row.year">
                  <td>{{ row.year }}</td>
                  <td>{{ row.orders }}</td>
                  <td>{{ row.itemsSold }}</td>
                  <td>{{ formatCurrency(row.revenue) }}</td>
                </tr>
                <tr v-if="!yearlyBreakdown.length">
                  <td colspan="4">No yearly data yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="table-block summary-block">
          <h3>Summary Statistics</h3>
          <div class="summary-grid">
            <div class="summary-card" v-for="row in summaryStats" :key="row.id">
              <p>{{ row.label }}</p>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </article>
      </section>
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

.badge.danger {
  background: rgba(145, 45, 63, 0.86);
  border-color: rgba(255, 165, 178, 0.5);
  color: #ffe3e8;
}

.badge.neutral {
  background: rgba(45, 97, 131, 0.85);
  color: #e7f6ff;
}

.reports-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.metric-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.68);
  padding: 0.7rem;
}

.metric-card.green {
  border-color: rgba(118, 222, 175, 0.5);
}

.metric-card.blue {
  border-color: rgba(116, 184, 247, 0.5);
}

.metric-card.purple {
  border-color: rgba(159, 135, 246, 0.5);
}

.metric-card.gold {
  border-color: rgba(243, 212, 120, 0.5);
}

.metric-card.teal {
  border-color: rgba(105, 212, 210, 0.5);
}

.metric-card.red {
  border-color: rgba(240, 126, 149, 0.5);
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.metric-head p {
  margin: 0;
  font-size: 0.82rem;
  color: #d7fff0;
  font-weight: 700;
}

.metric-tag {
  border: 1px solid rgba(127, 229, 194, 0.36);
  border-radius: 999px;
  padding: 0.08rem 0.35rem;
  font-size: 0.6rem;
  text-transform: uppercase;
  color: #d8fff2;
}

.metric-value {
  margin: 0.4rem 0 0;
  font-size: 1.55rem;
  font-weight: 900;
  color: #dbfff1;
}

.metric-sub {
  margin: 0.38rem 0 0;
  font-size: 0.75rem;
  color: #bfeede;
}

.metric-divider {
  margin-top: 0.5rem;
  height: 10px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(86, 186, 146, 0.42), rgba(31, 69, 85, 0.16));
}

.metric-foot {
  margin-top: 0.48rem;
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: #c2f8e2;
}

.top-products .metric-sub {
  margin-bottom: 0.45rem;
}

.product-rank {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-top: 1px solid rgba(125, 220, 191, 0.18);
  font-size: 0.78rem;
  color: #d6fff1;
}

.product-rank:first-of-type {
  border-top: 0;
}

.report-tables {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.8rem;
}

.table-block {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.62);
  padding: 0.75rem;
}

.table-block h3 {
  margin: 0;
  color: #6de390;
  font-size: 1rem;
}

.table-wrap {
  margin-top: 0.6rem;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 540px;
}

th,
td {
  padding: 0.5rem 0.55rem;
  border-bottom: 1px solid rgba(126, 223, 192, 0.18);
  text-align: left;
  font-size: 0.8rem;
}

th {
  color: #80e48f;
  background: rgba(26, 80, 75, 0.34);
  font-weight: 800;
}

.summary-grid {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}

.summary-card {
  border: 1px solid rgba(126, 223, 192, 0.2);
  border-radius: 10px;
  background: rgba(9, 44, 58, 0.56);
  padding: 0.55rem;
}

.summary-card p {
  margin: 0;
  font-size: 0.74rem;
  color: #b9efda;
}

.summary-card strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.1rem;
  color: #eafff4;
}

@media (max-width: 900px) {
  .reports-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .cards-grid,
  .reports-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
