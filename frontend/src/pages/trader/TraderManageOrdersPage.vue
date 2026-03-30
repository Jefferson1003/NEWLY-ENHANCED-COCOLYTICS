<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { fetchTraderSalesOrders, updateTraderSalesOrderStatus } from '../../services/api';
import { toMediaUrl } from '../../services/media';

const orders = ref([]);
const loading = ref(false);
const feedback = ref('');
const activeFilter = ref('all');
const searchTerm = ref('');
const updatingOrderIds = ref([]);
const viewMode = ref('list');
const dispatchOrderId = ref(null);
const dispatchNotes = ref('');
const highlightedOrderId = ref(null);
const showReceiptViewer = ref(false);
const receiptViewerSrc = ref('');
const SALES_ORDERS_UPDATED_EVENT = 'cocolytics-sales-orders-updated';
const FAST_ORDERS_POLL_MS = 2500;
let ordersPollTimer = null;

function emitSalesOrdersUpdated() {
  window.dispatchEvent(new CustomEvent(SALES_ORDERS_UPDATED_EVENT));
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() || 'unknown';
}

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function formatStatus(value) {
  return normalizeStatus(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizePaymentMethod(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePaymentStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isPendingGcashForVerification(order) {
  return normalizeStatus(order?.status) === 'pending'
    && normalizePaymentMethod(order?.paymentMethod) === 'gcash'
    && normalizePaymentStatus(order?.paymentStatus) === 'to_verify';
}

function statusLabel(order) {
  if (isPendingGcashForVerification(order)) {
    return 'To Verify GCash';
  }

  return formatStatus(order?.status);
}

function formatOrderDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatDispatchDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function itemLineTotal(item) {
  const lineTotal = Number(item?.lineTotal);
  if (Number.isFinite(lineTotal) && lineTotal >= 0) {
    return lineTotal;
  }

  const fallback = Number(item?.unitPrice || 0) * Number(item?.quantity || 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

function orderTotal(order) {
  return (order?.items || []).reduce((sum, item) => sum + itemLineTotal(item), 0);
}

function fullAddress(order) {
  const direct = String(order?.deliveryFullAddress || '').trim();
  if (direct) return direct;

  const parts = [
    order?.deliveryStreetAddress,
    order?.deliveryBarangay,
    order?.deliveryCity,
    order?.deliveryProvince,
    order?.deliveryRegion,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  return parts.length ? parts.join(', ') : '-';
}

function openReceiptViewer(imagePath) {
  const src = toImageUrl(imagePath);
  if (!src) {
    return;
  }

  receiptViewerSrc.value = src;
  showReceiptViewer.value = true;
}

function closeReceiptViewer() {
  showReceiptViewer.value = false;
  receiptViewerSrc.value = '';
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

async function loadOrders(options = {}) {
  const { silent = false, emitEvent = true } = options;

  if (!silent) {
    loading.value = true;
    feedback.value = '';
  }

  try {
    const data = await fetchTraderSalesOrders();
    orders.value = data.orders || [];
    if (emitEvent) {
      emitSalesOrdersUpdated();
    }
  } catch (error) {
    if (!silent) {
      feedback.value = error.message;
    }
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
}

function startOrdersRealtimePolling() {
  if (ordersPollTimer) {
    clearInterval(ordersPollTimer);
    ordersPollTimer = null;
  }

  ordersPollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') {
      return;
    }

    if (updatingOrderIds.value.length > 0) {
      return;
    }

    loadOrders({ silent: true, emitEvent: false });
  }, FAST_ORDERS_POLL_MS);
}

function stopOrdersRealtimePolling() {
  if (ordersPollTimer) {
    clearInterval(ordersPollTimer);
    ordersPollTimer = null;
  }
}

function openDispatchForm(order) {
  const orderId = Number(order?.id || 0);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    feedback.value = 'Invalid order selected.';
    return;
  }

  if (normalizeStatus(order.status) !== 'pending') {
    feedback.value = 'Only pending orders can be dispatched.';
    return;
  }

  dispatchOrderId.value = orderId;
  dispatchNotes.value = '';
  viewMode.value = 'dispatch';
}

function closeDispatchForm() {
  viewMode.value = 'list';
  dispatchOrderId.value = null;
  dispatchNotes.value = '';
}

const selectedDispatchOrder = computed(() => {
  const id = Number(dispatchOrderId.value || 0);
  if (!Number.isInteger(id) || id <= 0) return null;
  return orders.value.find((order) => Number(order.id) === id) || null;
});

const dispatchActionLabel = computed(() => {
  if (!selectedDispatchOrder.value) {
    return 'Dispatch';
  }

  return isPendingGcashForVerification(selectedDispatchOrder.value) ? 'Verify Payment' : 'Dispatch';
});

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
    await loadOrders();
    emitSalesOrdersUpdated();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    setUpdating(orderId, false);
  }
}

async function dispatchOrder(order) {
  const orderId = Number(order?.id || 0);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    feedback.value = 'Invalid order selected.';
    return;
  }

  if (normalizeStatus(order.status) !== 'pending') {
    feedback.value = 'Only pending orders can be accepted for shipping.';
    return;
  }

  if (normalizePaymentMethod(order.paymentMethod) === 'gcash') {
    if (normalizePaymentStatus(order.paymentStatus) !== 'to_verify' || !String(order.paymentReceiptPath || '').trim()) {
      feedback.value = 'GCash payment receipt must be submitted before verification.';
      return;
    }
  }

  setUpdating(orderId, true);
  try {
    await updateTraderSalesOrderStatus(orderId, 'to_ship');
    await loadOrders();
    activeFilter.value = 'to_ship';
    highlightedOrderId.value = orderId;
    closeDispatchForm();
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

onMounted(() => {
  loadOrders();
  startOrdersRealtimePolling();
});

onUnmounted(() => {
  stopOrdersRealtimePolling();
});
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Marketplace</p>
      <h1>Manage Orders</h1>
      <p class="sub">Track incoming product orders and update delivery status.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section v-if="viewMode === 'dispatch'" class="list-panel dispatch-panel">
      <header class="dispatch-head">
        <h2>Dispatch Form</h2>
        <button type="button" class="action-btn ghost" @click="closeDispatchForm">Back to Manage Orders</button>
      </header>

      <p v-if="!selectedDispatchOrder" class="muted">Selected order is no longer available.</p>

      <template v-else>
        <div class="dispatch-grid">
          <label class="dispatch-label">
            Order Number
            <input class="dispatch-input" type="text" :value="`#${selectedDispatchOrder.id}`" readonly />
          </label>
          <label class="dispatch-label">
            Name
            <input class="dispatch-input" type="text" :value="selectedDispatchOrder.customerFullName || '-'" readonly />
          </label>
          <label class="dispatch-label">
            Contact Number
            <input class="dispatch-input" type="text" :value="selectedDispatchOrder.customerContactNumber || '-'" readonly />
          </label>
          <label class="dispatch-label">
            Address
            <textarea class="dispatch-input" rows="3" readonly :value="fullAddress(selectedDispatchOrder)"></textarea>
          </label>
          <label class="dispatch-label">
            Notes
            <textarea class="dispatch-input" rows="2" readonly :value="selectedDispatchOrder.deliveryNotes || '-'"></textarea>
          </label>
        </div>

        <section class="dispatch-items">
          <h3>Order Items</h3>
          <article
            v-for="item in selectedDispatchOrder.items"
            :key="item.id"
            class="order-item-row"
          >
            <img
              v-if="item.productImagePath"
              :src="toImageUrl(item.productImagePath)"
              alt="Product"
              class="cart-image"
            />
            <div v-else class="cart-image placeholder">No Image</div>

            <div class="cart-content">
              <p class="order-product">{{ item.productName || '-' }}</p>
              <p class="desc-line">Product Type: {{ item.size || 'N/A' }}</p>
              <p class="desc-line">Unit Price: {{ formatCurrency(item.unitPrice) }}</p>
            </div>

            <div class="cart-right">
              <p class="order-qty">Quantity: {{ item.quantity ?? '-' }}</p>
              <p class="order-qty">Line Total: {{ formatCurrency(itemLineTotal(item)) }}</p>
            </div>
          </article>
          <p class="order-total-line">
            <strong>Order Total:</strong> {{ formatCurrency(orderTotal(selectedDispatchOrder)) }}
          </p>
        </section>

        <section
          v-if="normalizePaymentMethod(selectedDispatchOrder.paymentMethod) === 'gcash'"
          class="dispatch-items"
        >
          <h3>GCash Payment Receipt</h3>
          <p class="desc-line">
            Status:
            {{ normalizePaymentStatus(selectedDispatchOrder.paymentStatus) === 'to_verify' ? 'To Verify GCash' : normalizePaymentStatus(selectedDispatchOrder.paymentStatus) || '-' }}
          </p>
          <img
            v-if="selectedDispatchOrder.paymentReceiptPath"
            :src="toImageUrl(selectedDispatchOrder.paymentReceiptPath)"
            alt="GCash payment receipt"
            class="receipt-image clickable"
            @click="openReceiptViewer(selectedDispatchOrder.paymentReceiptPath)"
          />
          <p v-else class="muted">No payment receipt uploaded.</p>
        </section>

        <label class="dispatch-label">
          Dispatch Field / Textbox
          <textarea
            class="dispatch-input"
            v-model="dispatchNotes"
            rows="4"
            maxlength="500"
            placeholder="Add dispatch note (optional)"
          ></textarea>
        </label>

        <div class="dispatch-actions">
          <button
            type="button"
            class="action-btn"
            :disabled="isUpdating(selectedDispatchOrder.id)"
            @click="dispatchOrder(selectedDispatchOrder)"
          >
            {{ isUpdating(selectedDispatchOrder.id) ? 'Updating...' : dispatchActionLabel }}
          </button>
        </div>
      </template>
    </section>

    <section v-else class="list-panel">
      <p class="count-line">
        Showing {{ filteredCount }} of {{ totalCount }} orders
      </p>

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
        <article
          v-for="order in filteredOrders"
          :key="order.id"
          :class="['order-card', { highlighted: Number(order.id) === Number(highlightedOrderId) }]"
        >
          <header class="order-head">
            <div>
              <h3>Order #{{ order.id }}</h3>
              <p>{{ formatOrderDate(order.createdAt) }}</p>
              <p class="cell-sub">Buyer: {{ order.buyerName || '-' }}</p>
            </div>
            <span class="badge">{{ statusLabel(order) }}</span>
          </header>

          <div class="order-meta">
            <p><strong>Name:</strong> {{ order.customerFullName || '-' }}</p>
            <p><strong>Contact Number:</strong> {{ order.customerContactNumber || '-' }}</p>
            <p><strong>Address:</strong> {{ fullAddress(order) }}</p>
            <p><strong>Dispatch Date:</strong> {{ formatDispatchDate(order.dispatchDate) }}</p>
            <p><strong>Payment Method:</strong> {{ order.paymentMethod || 'cash_on_delivery' }}</p>
            <p v-if="normalizePaymentMethod(order.paymentMethod) === 'gcash'">
              <strong>Payment Status:</strong>
              {{ normalizePaymentStatus(order.paymentStatus) === 'to_verify' ? 'To Verify GCash' : normalizePaymentStatus(order.paymentStatus) || '-' }}
            </p>
            <p><strong>Notes:</strong> {{ order.deliveryNotes || '-' }}</p>
            <p><strong>Order Total:</strong> {{ formatCurrency(orderTotal(order)) }}</p>
            <p v-if="order.paymentReceiptPath">
              <strong>Payment Receipt:</strong>
              <button type="button" class="receipt-open-btn" @click="openReceiptViewer(order.paymentReceiptPath)">
                View Receipt
              </button>
            </p>
          </div>

          <div class="order-items">
            <article v-for="item in order.items" :key="item.id" class="order-item-row">
              <img
                v-if="item.productImagePath"
                :src="toImageUrl(item.productImagePath)"
                alt="Product"
                class="cart-image"
              />
              <div v-else class="cart-image placeholder">No Image</div>

              <div class="cart-content">
                <p class="order-product">{{ item.productName || '-' }}</p>
                <p class="desc-line">Product Type: {{ item.size || 'N/A' }}</p>
                <p class="desc-line">Unit Price: {{ formatCurrency(item.unitPrice) }}</p>
              </div>

              <div class="cart-right">
                <p class="order-qty">Quantity: {{ item.quantity ?? '-' }}</p>
                <p class="order-qty">Line Total: {{ formatCurrency(itemLineTotal(item)) }}</p>
              </div>
            </article>
          </div>

          <div class="order-actions">
            <button
              v-if="normalizeStatus(order.status) === 'pending'"
              type="button"
              class="action-btn"
              :disabled="isUpdating(order.id)"
              @click="openDispatchForm(order)"
            >
              {{ isUpdating(order.id) ? 'Updating...' : (isPendingGcashForVerification(order) ? 'Verify Payment' : 'Dispatch') }}
            </button>
            <button
              v-else-if="normalizeStatus(order.status) === 'to_ship'"
              type="button"
              class="action-btn"
              :disabled="isUpdating(order.id)"
              @click="markOrderToReceive(order)"
            >
              {{ isUpdating(order.id) ? 'Updating...' : 'Mark To Receive' }}
            </button>
            <span v-else class="muted">No action</span>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="showReceiptViewer"
      class="receipt-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Payment receipt preview"
      @click.self="closeReceiptViewer"
    >
      <section class="receipt-viewer-card">
        <button type="button" class="receipt-close-btn" aria-label="Close receipt preview" @click="closeReceiptViewer">X</button>
        <img :src="receiptViewerSrc" alt="GCash payment receipt preview" class="receipt-viewer-image" />
      </section>
    </div>
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

.dispatch-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
}

.dispatch-head h2 {
  margin: 0;
}

.dispatch-grid {
  margin-top: 0.65rem;
  display: grid;
  gap: 0.55rem;
}

.dispatch-label {
  display: grid;
  gap: 0.3rem;
  color: #d9fff1;
  font-weight: 700;
  font-size: 0.9rem;
}

.dispatch-input {
  width: 100%;
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 10px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  padding: 0.58rem 0.65rem;
  font: inherit;
  resize: vertical;
}

.dispatch-input[readonly] {
  cursor: default;
}

.dispatch-items {
  margin-top: 0.75rem;
}

.dispatch-items h3 {
  margin: 0 0 0.45rem;
}

.order-total-line {
  margin: 0.25rem 0 0;
  color: #e5fff5;
  font-size: 0.86rem;
}

.receipt-image {
  margin-top: 0.45rem;
  width: min(320px, 100%);
  max-height: 360px;
  object-fit: contain;
  border-radius: 10px;
  border: 1px solid rgba(133, 229, 197, 0.35);
  background: rgba(5, 27, 37, 0.75);
}

.receipt-image.clickable {
  cursor: zoom-in;
}

.receipt-open-btn {
  margin-left: 0.4rem;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 8px;
  background: #1f67a8;
  color: #ecfff7;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}

.receipt-viewer-modal {
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(2, 9, 16, 0.76);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.receipt-viewer-card {
  position: relative;
  width: min(92vw, 700px);
  max-height: 88vh;
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 14px;
  background: rgba(5, 27, 37, 0.92);
  padding: 0.8rem;
}

.receipt-close-btn {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 8px;
  background: rgba(5, 27, 37, 0.85);
  color: #ecfff7;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.receipt-viewer-image {
  width: 100%;
  max-height: calc(88vh - 1.6rem);
  object-fit: contain;
  border-radius: 10px;
  background: rgba(5, 27, 37, 0.75);
}

.dispatch-actions {
  margin-top: 0.7rem;
  display: flex;
  justify-content: flex-end;
}

.order-card {
  border: 1px solid rgba(126, 223, 192, 0.32);
  border-radius: 14px;
  background: rgba(5, 26, 36, 0.72);
  padding: 0.75rem;
}

.order-card.highlighted {
  border-color: rgba(255, 240, 148, 0.9);
  box-shadow: 0 0 0 2px rgba(255, 240, 148, 0.45);
}

.order-head {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: center;
}

.order-head h3 {
  margin: 0;
  font-size: 1rem;
}

.order-head p {
  margin: 0.2rem 0 0;
  color: #c3f7e3;
  font-size: 0.8rem;
}

.cell-sub {
  margin: 0.15rem 0 0;
  color: #c3f7e3;
  font-size: 0.74rem;
}

.badge {
  display: inline-block;
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

.order-item-row {
  border: 1px solid rgba(126, 223, 192, 0.22);
  border-radius: 10px;
  padding: 0.5rem;
  display: grid;
  grid-template-columns: 66px 1fr auto;
  gap: 0.55rem;
  align-items: center;
}

.cart-image {
  width: 66px;
  height: 66px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.cart-image.placeholder {
  display: grid;
  place-items: center;
  color: #d5fff0;
  background: rgba(5, 27, 37, 0.75);
}

.cart-content {
  min-width: 0;
}

.order-product {
  margin: 0;
  color: #e6fff4;
  font-weight: 800;
  font-size: 0.92rem;
}

.desc-line {
  margin: 0.2rem 0 0;
  color: #d2ffef;
  font-size: 0.82rem;
}

.cart-right {
  justify-self: end;
}

.order-qty {
  margin: 0;
  font-weight: 800;
  color: #dcfff2;
}

.order-actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
  align-items: center;
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

.action-btn.ghost {
  background: rgba(5, 27, 37, 0.75);
}

.action-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .order-item-row {
    grid-template-columns: 1fr;
  }

  .cart-image {
    width: 100%;
    height: 120px;
  }

  .cart-right {
    justify-self: start;
  }
}
</style>
