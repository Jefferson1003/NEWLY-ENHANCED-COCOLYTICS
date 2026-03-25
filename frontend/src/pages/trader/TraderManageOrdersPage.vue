<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchTraderSalesOrders, updateTraderSalesOrderStatus } from '../../services/api';
import { toMediaUrl } from '../../services/media';

const orders = ref([]);
const loading = ref(false);
const feedback = ref('');
const activeFilter = ref('all');
const searchTerm = ref('');
const updatingOrderIds = ref([]);
const SALES_ORDERS_UPDATED_EVENT = 'cocolytics-sales-orders-updated';

function emitSalesOrdersUpdated() {
  window.dispatchEvent(new CustomEvent(SALES_ORDERS_UPDATED_EVENT));
}

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() || 'unknown';
}

function formatStatus(value) {
  return normalizeStatus(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatOrderDate(value) {
  return new Date(value).toLocaleString();
}

function isUpdating(orderId) {
  return updatingOrderIds.value.includes(orderId);
}

function setUpdating(orderId, updating) {
  if (updating) {
    if (!updatingOrderIds.value.includes(orderId)) {
      updatingOrderIds.value = [...updatingOrderIds.value, orderId];
    }
    return;
  }

  updatingOrderIds.value = updatingOrderIds.value.filter((id) => id !== orderId);
}

async function loadOrders() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchTraderSalesOrders();
    orders.value = data.orders || [];
    emitSalesOrdersUpdated();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function markOrderToReceive(order) {
  const orderId = Number(order?.id || 0);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    feedback.value = 'Invalid order selected.';
    return;
  }

  if (normalizeStatus(order.status) !== 'to_ship') {
    feedback.value = 'Only To Ship orders can be updated to To Receive.';
    return;
  }

  setUpdating(orderId, true);
  try {
    await updateTraderSalesOrderStatus(orderId, 'to_receive');
    order.status = 'to_receive';
    emitSalesOrdersUpdated();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    setUpdating(orderId, false);
  }
}

async function acceptAndShipOrder(order) {
  const orderId = Number(order?.id || 0);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    feedback.value = 'Invalid order selected.';
    return;
  }

  if (normalizeStatus(order.status) !== 'pending') {
    feedback.value = 'Only pending orders can be accepted for shipping.';
    return;
  }

  setUpdating(orderId, true);
  try {
    await updateTraderSalesOrderStatus(orderId, 'to_ship');
    order.status = 'to_ship';
    emitSalesOrdersUpdated();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    setUpdating(orderId, false);
  }
}

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'to_ship', label: 'To Ship' },
  { key: 'to_receive', label: 'To Receive' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const orderCountByStatus = computed(() => {
  const counts = {
    all: orders.value.length,
    pending: 0,
    to_ship: 0,
    to_receive: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const order of orders.value) {
    const status = normalizeStatus(order.status);
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    }
  }

  return counts;
});

function orderMatchesSearch(order, keyword) {
  if (!keyword) return true;

  const id = String(order?.id || '');
  const buyer = String(order?.buyerName || '');
  const fullName = String(order?.customerFullName || '');
  const contact = String(order?.customerContactNumber || '');
  const address = String(order?.deliveryFullAddress || '');
  const deliveryNotes = String(order?.deliveryNotes || '');
  const itemSummary = (order?.items || [])
    .map((item) => `${item?.productName || ''} ${item?.size || ''}`)
    .join(' ');

  const searchable = `${id} ${buyer} ${fullName} ${contact} ${address} ${deliveryNotes} ${itemSummary}`
    .toLowerCase();

  return searchable.includes(keyword);
}

const filteredOrders = computed(() => {
  const filter = activeFilter.value;
  const keyword = String(searchTerm.value || '').trim().toLowerCase();
  return orders.value.filter((order) => {
    const statusMatch = filter === 'all' || normalizeStatus(order.status) === filter;
    if (!statusMatch) return false;
    return orderMatchesSearch(order, keyword);
  });
});

const filteredCount = computed(() => filteredOrders.value.length);
const totalCount = computed(() => orders.value.length);

onMounted(loadOrders);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Marketplace</p>
      <h1>Manage Orders</h1>
      <p class="sub">Track incoming product orders and update delivery status.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section class="list-panel">
      <p class="count-line">Showing {{ filteredCount }} of {{ totalCount }} orders</p>

      <label class="search-wrap">
        <span>Search Orders</span>
        <input
          v-model="searchTerm"
          type="text"
          class="search-input"
          placeholder="Search order #, buyer, product, address"
        />
      </label>

      <div class="filter-row">
        <button
          v-for="item in statusFilters"
          :key="item.key"
          type="button"
          :class="['filter-btn', { active: activeFilter === item.key }]"
          @click="activeFilter = item.key"
        >
          {{ item.label }} ({{ orderCountByStatus[item.key] || 0 }})
        </button>
      </div>

      <p v-if="loading" class="muted">Loading incoming orders...</p>
      <p v-else-if="!totalCount" class="muted">No incoming orders found.</p>
      <p v-else-if="!filteredCount" class="muted">No matching orders found.</p>

      <div v-else class="orders-cards">
        <article v-for="order in filteredOrders" :key="order.id" class="order-card">
          <header class="order-head">
            <div>
              <h2>Order #{{ order.id }}</h2>
              <p>{{ formatOrderDate(order.createdAt) }}</p>
            </div>
            <span class="badge">{{ formatStatus(order.status) }}</span>
          </header>

          <section class="order-meta">
            <p><strong>Buyer:</strong> {{ order.buyerName || '-' }}</p>
            <p><strong>Full Name:</strong> {{ order.customerFullName || '-' }}</p>
            <p><strong>Contact:</strong> {{ order.customerContactNumber || '-' }}</p>
            <p><strong>Address:</strong> {{ order.deliveryFullAddress || '-' }}</p>
            <p><strong>Payment:</strong> {{ order.paymentMethod || 'cash_on_delivery' }}</p>
            <p><strong>Delivery Notes:</strong> {{ order.deliveryNotes || '-' }}</p>
          </section>

          <section class="order-items">
            <article v-for="item in order.items" :key="item.id" class="order-item-card">
              <img
                v-if="item.productImagePath"
                :src="toImageUrl(item.productImagePath)"
                alt="Product"
                class="item-image"
              />
              <div v-else class="item-image placeholder">No Image</div>

              <div class="item-content">
                <h3>{{ item.productName }}</h3>
                <p>Size: {{ item.size || 'N/A' }} | Length: {{ item.lengthCm ?? 'N/A' }} cm</p>
                <p class="qty">Qty: {{ item.quantity }}</p>
              </div>
            </article>
          </section>

          <div class="order-actions">
            <button
              v-if="normalizeStatus(order.status) === 'pending'"
              type="button"
              class="action-btn"
              :disabled="isUpdating(order.id)"
              @click="acceptAndShipOrder(order)"
            >
              {{ isUpdating(order.id) ? 'Updating...' : 'Accept and Ship' }}
            </button>
            <button
              v-if="normalizeStatus(order.status) === 'to_ship'"
              type="button"
              class="action-btn"
              :disabled="isUpdating(order.id)"
              @click="markOrderToReceive(order)"
            >
              {{ isUpdating(order.id) ? 'Updating...' : 'Mark as To Receive' }}
            </button>
          </div>
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

.feedback {
  margin-top: 0.8rem;
  color: #ffd2da;
}

.list-panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
}

.count-line {
  margin: 0;
  color: #c8fce6;
  font-size: 0.84rem;
}

.search-wrap {
  margin-top: 0.65rem;
  display: grid;
  gap: 0.35rem;
  color: #d7fff1;
  font-size: 0.82rem;
}

.search-input {
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 10px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  padding: 0.58rem 0.65rem;
  font: inherit;
}

.filter-row {
  margin-top: 0.65rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.filter-btn {
  border: 1px solid rgba(126, 223, 192, 0.35);
  border-radius: 10px;
  background: rgba(8, 44, 57, 0.85);
  color: #dffef2;
  padding: 0.45rem 0.65rem;
  font-weight: 700;
  cursor: pointer;
}

.filter-btn.active {
  background: #eaf6ef;
  color: #346f60;
}

.muted {
  margin-top: 0.7rem;
  color: #c2f7e0;
}

.orders-cards {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.75rem;
}

.order-card {
  border: 1px solid rgba(126, 223, 192, 0.32);
  border-radius: 14px;
  background: rgba(5, 26, 36, 0.72);
  padding: 0.75rem;
}

.order-head {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: center;
}

.order-head h2 {
  margin: 0;
  font-size: 1.08rem;
}

.order-head p {
  margin: 0.2rem 0 0;
  color: #c3f7e3;
  font-size: 0.8rem;
}

.badge {
  border-radius: 999px;
  border: 1px solid rgba(133, 229, 197, 0.45);
  background: rgba(30, 86, 69, 0.72);
  color: #c8ffe8;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.order-meta {
  margin-top: 0.6rem;
  border: 1px solid rgba(126, 223, 192, 0.2);
  border-radius: 10px;
  padding: 0.55rem;
  background: rgba(4, 28, 39, 0.62);
  display: grid;
  gap: 0.22rem;
}

.order-meta p {
  margin: 0;
  color: #d7fff1;
  font-size: 0.82rem;
}

.order-items {
  margin-top: 0.65rem;
  display: grid;
  gap: 0.45rem;
}

.order-item-card {
  border: 1px solid rgba(126, 223, 192, 0.22);
  border-radius: 10px;
  padding: 0.5rem;
  display: grid;
  grid-template-columns: 66px 1fr;
  gap: 0.55rem;
  align-items: center;
}

.item-image {
  width: 66px;
  height: 66px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.item-image.placeholder {
  display: grid;
  place-items: center;
  color: #d5fff0;
  background: rgba(5, 27, 37, 0.75);
}

.item-content h3 {
  margin: 0;
  color: #e6fff4;
  font-size: 0.92rem;
}

.item-content p {
  margin: 0.2rem 0 0;
  color: #d2ffef;
  font-size: 0.82rem;
}

.item-content .qty {
  font-weight: 800;
}

.order-actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #1f67a8;
  color: #ecfff7;
  padding: 0.5rem 0.72rem;
  font-weight: 800;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .order-item-card {
    grid-template-columns: 1fr;
  }

  .item-image {
    width: 100%;
    height: 120px;
  }
}
</style>
