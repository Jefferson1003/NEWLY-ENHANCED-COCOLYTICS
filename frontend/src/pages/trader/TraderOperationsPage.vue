<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchTraderSalesOrders } from '../../services/api';

const activeFilter = ref('scanner');
const loading = ref(false);
const exporting = ref(false);
const feedback = ref('');
const salesOrders = ref([]);

const completedStatuses = new Set(['completed', 'delivered', 'fulfilled']);

function orderRevenue(order) {
  return (order.items || []).reduce((sum, item) => {
    const lineTotal = Number(item?.lineTotal);
    if (Number.isFinite(lineTotal) && lineTotal >= 0) {
      return sum + lineTotal;
    }

    const fallback = Number(item?.unitPrice || 0) * Number(item?.quantity || 0);
    return sum + (Number.isFinite(fallback) ? fallback : 0);
  }, 0);
}

const totalOrders = computed(() => salesOrders.value.length);

const completedOrdersCount = computed(() => {
  return salesOrders.value.filter((order) => completedStatuses.has(String(order.status || '').toLowerCase())).length;
});

const totalItemsSold = computed(() => {
  return salesOrders.value
    .filter((order) => completedStatuses.has(String(order.status || '').toLowerCase()))
    .reduce((sum, order) => {
      return sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0);
    }, 0);
});

const totalSalesRevenue = computed(() => {
  return Number(
    salesOrders.value
      .filter((order) => completedStatuses.has(String(order.status || '').toLowerCase()))
      .reduce((sum, order) => sum + orderRevenue(order), 0)
      .toFixed(2)
  );
});

const pendingDispatchCount = computed(() => {
  return salesOrders.value.filter((order) => {
    const status = String(order.status || '').toLowerCase();
    return !completedStatuses.has(status) && status !== 'cancelled';
  }).length;
});

const ratedOrders = computed(() => {
  return salesOrders.value.filter((order) => {
    const rating = Number(order.buyerRating);
    return Number.isFinite(rating) && rating >= 1 && rating <= 5;
  });
});

const ratedOrdersCount = computed(() => ratedOrders.value.length);

const averageRating = computed(() => {
  if (!ratedOrders.value.length) return 0;
  const ratingTotal = ratedOrders.value.reduce((sum, order) => sum + Number(order.buyerRating || 0), 0);
  return Number((ratingTotal / ratedOrders.value.length).toFixed(1));
});

const growthPercent = computed(() => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthSold = salesOrders.value
    .filter((order) => {
      const date = new Date(order.createdAt);
      return (
        completedStatuses.has(String(order.status || '').toLowerCase())
        && date.getFullYear() === currentYear
        && date.getMonth() === currentMonth
      );
    })
    .reduce((sum, order) => sum + (order.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0), 0);

  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const previousMonthSold = salesOrders.value
    .filter((order) => {
      const date = new Date(order.createdAt);
      return (
        completedStatuses.has(String(order.status || '').toLowerCase())
        && date.getFullYear() === previousYear
        && date.getMonth() === previousMonth
      );
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
    if (!completedStatuses.has(String(order.status || '').toLowerCase())) {
      continue;
    }

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
    if (!completedStatuses.has(String(order.status || '').toLowerCase())) {
      continue;
    }

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
    row.revenue += orderRevenue(order);
  }

  return Array.from(rows.values())
    .sort((a, b) => b.key.localeCompare(a.key));
});

const yearlyBreakdown = computed(() => {
  const rows = new Map();

  for (const order of salesOrders.value) {
    if (!completedStatuses.has(String(order.status || '').toLowerCase())) {
      continue;
    }

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
    row.revenue += orderRevenue(order);
  }

  return Array.from(rows.values())
    .sort((a, b) => b.year.localeCompare(a.year));
});

const reportCards = computed(() => {
  return [
    {
      id: 'total-revenue',
      title: 'Total Sales Revenue',
      value: formatCurrency(totalSalesRevenue.value),
      subtitle: 'Revenue from completed sales',
      footerLeft: `Completed: ${completedOrdersCount.value}`,
      footerRight: `Units: ${totalItemsSold.value}`,
      accent: 'teal',
      tag: 'live',
    },
    {
      id: 'completed-sales',
      title: 'Completed Sales',
      value: `${completedOrdersCount.value} orders`,
      subtitle: 'Only completed orders are counted as sales',
      footerLeft: `Items Sold: ${totalItemsSold.value}`,
      footerRight: `Rated: ${ratedOrdersCount.value}`,
      accent: 'green',
      tag: 'live',
    },
    {
      id: 'items-sold',
      title: 'Items Sold',
      value: `${totalItemsSold.value} units`,
      subtitle: 'Completed-order quantity only',
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
      footerRight: `In Progress: ${pendingDispatchCount.value}`,
      accent: 'purple',
      tag: 'live',
    },
    {
      id: 'rating',
      title: 'Rating',
      value: ratedOrdersCount.value ? `${averageRating.value.toFixed(1)} ★` : 'N/A',
      subtitle: 'Average buyer rating from completed orders',
      footerLeft: `Rated Orders: ${ratedOrdersCount.value}`,
      footerRight: ratedOrdersCount.value ? 'Based on buyer feedback' : 'No ratings yet',
      accent: 'gold',
      tag: ratedOrdersCount.value ? averageRating.value.toFixed(1) : 'N/A',
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
    { id: 'sum-revenue', label: 'Total Sales Revenue', value: formatCurrency(totalSalesRevenue.value) },
    { id: 'sum-sales', label: 'Completed Sales', value: String(completedOrdersCount.value) },
    { id: 'sum-items', label: 'Total Items Sold', value: String(totalItemsSold.value) },
    { id: 'sum-orders', label: 'Total Orders', value: String(totalOrders.value) },
    {
      id: 'sum-rating',
      label: 'Average Rating',
      value: ratedOrdersCount.value ? `${averageRating.value.toFixed(1)}/5.0` : 'N/A',
    },
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

function applySheetTitleStyle(cell) {
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFE8FFF4' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D3F4D' },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF78DFC1' } },
    left: { style: 'thin', color: { argb: 'FF78DFC1' } },
    bottom: { style: 'thin', color: { argb: 'FF78DFC1' } },
    right: { style: 'thin', color: { argb: 'FF78DFC1' } },
  };
}

function applyTableHeaderStyle(row) {
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD8FFF2' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF155160' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF245F6A' } },
      left: { style: 'thin', color: { argb: 'FF245F6A' } },
      bottom: { style: 'thin', color: { argb: 'FF245F6A' } },
      right: { style: 'thin', color: { argb: 'FF245F6A' } },
    };
  });
}

function applyTableBodyStyle(row, isEven) {
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FFD8FFF1' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? 'FF0E3C47' : 'FF0A2D38' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF174D58' } },
      left: { style: 'thin', color: { argb: 'FF174D58' } },
      bottom: { style: 'thin', color: { argb: 'FF174D58' } },
      right: { style: 'thin', color: { argb: 'FF174D58' } },
    };
  });
}

async function exportReportsToExcel() {
  if (exporting.value) {
    return;
  }

  exporting.value = true;
  feedback.value = '';

  try {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cocolytics';
    workbook.created = new Date();

    const overview = workbook.addWorksheet('Operations Report', { views: [{ showGridLines: false }] });
    overview.columns = [
      { width: 34 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
    ];

    overview.mergeCells('A1:D1');
    overview.getCell('A1').value = 'Cocolytics Trader Operations Report';
    applySheetTitleStyle(overview.getCell('A1'));

    overview.mergeCells('A2:D2');
    overview.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    overview.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FFBDEEDC' } };
    overview.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A2F3A' },
    };

    const summaryHeader = overview.addRow(['Summary Statistics', '', '', '']);
    overview.mergeCells(`A${summaryHeader.number}:D${summaryHeader.number}`);
    applySheetTitleStyle(overview.getCell(`A${summaryHeader.number}`));

    const summaryTableHeader = overview.addRow(['Metric', 'Value', 'Metric', 'Value']);
    applyTableHeaderStyle(summaryTableHeader);

    const summaryRows = [
      [summaryStats.value[0]?.label || 'Total Sales Revenue', summaryStats.value[0]?.value || formatCurrency(0), summaryStats.value[1]?.label || 'Completed Sales', summaryStats.value[1]?.value || '0'],
      [summaryStats.value[2]?.label || 'Total Items Sold', summaryStats.value[2]?.value || '0', summaryStats.value[3]?.label || 'Total Orders', summaryStats.value[3]?.value || '0'],
      [summaryStats.value[4]?.label || 'Average Rating', summaryStats.value[4]?.value || 'N/A', '', ''],
    ];

    summaryRows.forEach((entry, index) => {
      const row = overview.addRow(entry);
      applyTableBodyStyle(row, index % 2 === 0);
    });

    overview.addRow([]);

    const topHeader = overview.addRow(['Top Products', '', '', '']);
    overview.mergeCells(`A${topHeader.number}:D${topHeader.number}`);
    applySheetTitleStyle(overview.getCell(`A${topHeader.number}`));

    const topTableHeader = overview.addRow(['Product', 'Size', 'Quantity', 'Tag']);
    applyTableHeaderStyle(topTableHeader);

    const topRows = topProducts.value.length
      ? topProducts.value.slice(0, 10).map((row, index) => [row.productName, row.size, row.quantity, index < 3 ? 'Trending' : ''])
      : [['No sold products yet', '-', 0, '-']];

    topRows.forEach((entry, index) => {
      const row = overview.addRow(entry);
      applyTableBodyStyle(row, index % 2 === 0);
    });

    overview.addRow([]);

    const kpiHeader = overview.addRow(['Report KPI Cards', '', '', '']);
    overview.mergeCells(`A${kpiHeader.number}:D${kpiHeader.number}`);
    applySheetTitleStyle(overview.getCell(`A${kpiHeader.number}`));

    const kpiTableHeader = overview.addRow(['Title', 'Value', 'Subtitle', 'Details']);
    applyTableHeaderStyle(kpiTableHeader);

    reportCards.value.forEach((card, index) => {
      const row = overview.addRow([
        card.title,
        card.value,
        card.subtitle,
        `${card.footerLeft} | ${card.footerRight}`,
      ]);
      applyTableBodyStyle(row, index % 2 === 0);
    });

    const monthlySheet = workbook.addWorksheet('Monthly Breakdown', { views: [{ showGridLines: false }] });
    monthlySheet.columns = [
      { width: 28 },
      { width: 14 },
      { width: 16 },
      { width: 18 },
    ];

    monthlySheet.mergeCells('A1:D1');
    monthlySheet.getCell('A1').value = 'Monthly Breakdown';
    applySheetTitleStyle(monthlySheet.getCell('A1'));

    const monthlyHeader = monthlySheet.addRow(['Month', 'Orders', 'Items Sold', 'Revenue']);
    applyTableHeaderStyle(monthlyHeader);

    const monthlyRows = monthlyBreakdown.value.length
      ? monthlyBreakdown.value
      : [{ label: 'No monthly data yet', orders: 0, itemsSold: 0, revenue: 0 }];

    monthlyRows.forEach((entry, index) => {
      const row = monthlySheet.addRow([
        entry.label,
        Number(entry.orders || 0),
        Number(entry.itemsSold || 0),
        Number(entry.revenue || 0),
      ]);
      applyTableBodyStyle(row, index % 2 === 0);
      row.getCell(4).numFmt = '[$₱-340A]#,##0.00';
    });

    const yearlySheet = workbook.addWorksheet('Yearly Breakdown', { views: [{ showGridLines: false }] });
    yearlySheet.columns = [
      { width: 18 },
      { width: 14 },
      { width: 16 },
      { width: 18 },
    ];

    yearlySheet.mergeCells('A1:D1');
    yearlySheet.getCell('A1').value = 'Yearly Breakdown';
    applySheetTitleStyle(yearlySheet.getCell('A1'));

    const yearlyHeader = yearlySheet.addRow(['Year', 'Orders', 'Items Sold', 'Revenue']);
    applyTableHeaderStyle(yearlyHeader);

    const yearlyRows = yearlyBreakdown.value.length
      ? yearlyBreakdown.value
      : [{ year: 'No yearly data yet', orders: 0, itemsSold: 0, revenue: 0 }];

    yearlyRows.forEach((entry, index) => {
      const row = yearlySheet.addRow([
        entry.year,
        Number(entry.orders || 0),
        Number(entry.itemsSold || 0),
        Number(entry.revenue || 0),
      ]);
      applyTableBodyStyle(row, index % 2 === 0);
      row.getCell(4).numFmt = '[$₱-340A]#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([
      buffer,
    ], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const fileDate = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cocolytics-operations-report-${fileDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    feedback.value = error?.message || 'Could not export report to Excel.';
  } finally {
    exporting.value = false;
  }
}

async function loadOperationsData() {
  loading.value = true;
  feedback.value = '';
  try {
    const salesOrdersData = await fetchTraderSalesOrders();

    salesOrders.value = salesOrdersData.orders || [];
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
      <p class="sub">Track scanner flow and reports in one page.</p>
    </header>

    <nav class="filters">
      <button type="button" :class="{ active: activeFilter === 'scanner' }" @click="activeFilter = 'scanner'">Scanner</button>
      <button type="button" :class="{ active: activeFilter === 'reports' }" @click="activeFilter = 'reports'">Reports</button>
    </nav>

    <section class="panel">
      <div class="panel-head">
        <h2>{{ filterLabel }}</h2>
        <button
          v-if="activeFilter === 'reports'"
          type="button"
          class="export-btn"
          :disabled="exporting"
          @click="exportReportsToExcel"
        >
          {{ exporting ? 'Exporting...' : 'Export Excel' }}
        </button>
      </div>
      <p v-if="feedback" class="feedback">{{ feedback }}</p>
      <p v-if="loading" class="muted">Loading operations data...</p>

      <div v-if="!loading && activeFilter === 'scanner'" class="cards-grid">
        <p class="muted">Content coming soon.</p>
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
          <p class="table-hint">Swipe left or right to view all columns.</p>
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
          <p class="table-hint">Swipe left or right to view all columns.</p>
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

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.export-btn {
  border: 1px solid rgba(128, 228, 143, 0.45);
  border-radius: 10px;
  background: linear-gradient(140deg, rgba(20, 95, 87, 0.95), rgba(13, 68, 72, 0.95));
  color: #eafff4;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.48rem 0.72rem;
  cursor: pointer;
}

.export-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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
  min-width: 0;
}

.table-block {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.62);
  padding: 0.75rem;
  min-width: 0;
  overflow: hidden;
}

.table-block h3 {
  margin: 0;
  color: #6de390;
  font-size: 1rem;
}

.table-wrap {
  margin-top: 0.6rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  padding-bottom: 0.24rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(119, 222, 184, 0.65) rgba(10, 44, 58, 0.5);
  max-width: 100%;
  min-width: 0;
}

.table-wrap::-webkit-scrollbar {
  height: 9px;
}

.table-wrap::-webkit-scrollbar-track {
  background: rgba(10, 44, 58, 0.5);
  border-radius: 99px;
}

.table-wrap::-webkit-scrollbar-thumb {
  background: rgba(119, 222, 184, 0.65);
  border-radius: 99px;
}

.table-hint {
  margin: 0.42rem 0 0;
  color: #9fdfca;
  font-size: 0.75rem;
}

table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  min-width: 620px;
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

  .panel-head {
    align-items: stretch;
    flex-direction: column;
  }

  .export-btn {
    width: 100%;
  }
}
</style>
