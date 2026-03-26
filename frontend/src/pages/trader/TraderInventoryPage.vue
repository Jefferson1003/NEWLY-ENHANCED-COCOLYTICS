<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { fetchTraderProducts, updateTraderProduct } from '../../services/api';
import { toMediaUrl } from '../../services/media';
import ConfirmationModal from '../../components/ConfirmationModal.vue';

const feedback = ref('');
const loading = ref(false);
const products = ref([]);
const searchText = ref('');
const stockSort = ref('none');
const restockInputs = reactive({});
const savingIds = ref([]);
const showRestockModal = ref(false);
const showRestockConfirmModal = ref(false);
const restockTargetProduct = ref(null);
const loadingModalStock = ref(false);
const INVENTORY_UPDATED_EVENT = 'cocolytics-inventory-updated';

const lowStockCount = computed(() => {
  return products.value.filter((product) => Number(product.stockQuantity || 0) < 20).length;
});

const filteredProducts = computed(() => {
  const keyword = String(searchText.value || '').trim().toLowerCase();
  if (!keyword) {
    return [...products.value];
  }

  return products.value.filter((product) => {
    const name = String(product.productName || '').toLowerCase();
    const size = String(product.size || '').toLowerCase();
    const stock = String(product.stockQuantity ?? '').toLowerCase();
    const length = String(product.lengthCm ?? '').toLowerCase();
    return (
      name.includes(keyword)
      || size.includes(keyword)
      || stock.includes(keyword)
      || length.includes(keyword)
    );
  });
});

const sortedProducts = computed(() => {
  const rows = [...filteredProducts.value];
  if (stockSort.value === 'low-high') {
    return rows.sort((a, b) => Number(a.stockQuantity || 0) - Number(b.stockQuantity || 0));
  }

  if (stockSort.value === 'high-low') {
    return rows.sort((a, b) => Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0));
  }

  return rows;
});

const restockQuantity = computed(() => {
  if (!restockTargetProduct.value) return 0;
  return Number(restockInputs[restockTargetProduct.value.id] || 0);
});

const projectedStock = computed(() => {
  if (!restockTargetProduct.value) return 0;
  return Number(restockTargetProduct.value.stockQuantity || 0) + Number(restockQuantity.value || 0);
});

const confirmationMessage = computed(() => {
  if (!restockTargetProduct.value) return 'Proceed with this restock?';
  return `Restock ${restockTargetProduct.value.productName} by ${restockQuantity.value} item(s)? New stock will be ${projectedStock.value}.`;
});

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function isSaving(productId) {
  return savingIds.value.includes(productId);
}

function setSaving(productId, saving) {
  if (saving) {
    if (!savingIds.value.includes(productId)) {
      savingIds.value = [...savingIds.value, productId];
    }
    return;
  }

  savingIds.value = savingIds.value.filter((id) => id !== productId);
}

function emitInventoryUpdated() {
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
}

function withLongDots(value, maxLength = 64) {
  const text = String(value || '').trim();
  if (!text) return 'No description yet.';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...........`;
}

function closeRestockModal() {
  showRestockModal.value = false;
  showRestockConfirmModal.value = false;
  restockTargetProduct.value = null;
  loadingModalStock.value = false;
}

async function refreshModalProductStock(productId) {
  loadingModalStock.value = true;
  try {
    const data = await fetchTraderProducts();
    const latestProducts = data.products || [];
    const latest = latestProducts.find((row) => row.id === productId);

    if (!latest) {
      return;
    }

    const localProduct = products.value.find((row) => row.id === productId);
    if (localProduct) {
      Object.assign(localProduct, latest);
    }

    if (restockTargetProduct.value && restockTargetProduct.value.id === productId) {
      Object.assign(restockTargetProduct.value, latest);
    }
  } catch (error) {
    feedback.value = error.message || 'Failed to fetch latest stock.';
  } finally {
    loadingModalStock.value = false;
  }
}

async function openRestockModal(product) {
  if (restockInputs[product.id] === undefined) {
    restockInputs[product.id] = 0;
  }

  feedback.value = '';
  restockTargetProduct.value = product;
  showRestockModal.value = true;
  await refreshModalProductStock(product.id);
}

function requestRestockConfirmation() {
  if (!restockTargetProduct.value) return;

  if (loadingModalStock.value) {
    feedback.value = 'Please wait while current stock is still loading.';
    return;
  }

  const restockQty = Number(restockInputs[restockTargetProduct.value.id] || 0);
  if (!Number.isInteger(restockQty) || restockQty <= 0) {
    feedback.value = 'Restock quantity must be a positive whole number.';
    return;
  }

  showRestockModal.value = false;
  showRestockConfirmModal.value = true;
}

function closeRestockConfirmation() {
  showRestockConfirmModal.value = false;
  if (restockTargetProduct.value) {
    showRestockModal.value = true;
  }
}

async function loadProducts() {
  loading.value = true;
  feedback.value = '';

  try {
    const data = await fetchTraderProducts();
    products.value = data.products || [];

    for (const product of products.value) {
      if (restockInputs[product.id] === undefined) {
        restockInputs[product.id] = 0;
      }
    }
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function restockProduct(product, restockQty) {
  if (!Number.isInteger(restockQty) || restockQty <= 0) {
    feedback.value = 'Restock quantity must be a positive whole number.';
    return false;
  }

  const nextStock = Number(product.stockQuantity || 0) + restockQty;

  setSaving(product.id, true);
  try {
    await updateTraderProduct(product.id, {
      productName: product.productName,
      size: product.size,
      lengthCm: product.lengthCm,
      productPrice: product.productPrice,
      stockQuantity: nextStock,
    });

    product.stockQuantity = nextStock;
    restockInputs[product.id] = 0;
    feedback.value = `${product.productName} restocked successfully.`;
    emitInventoryUpdated();
    return true;
  } catch (error) {
    feedback.value = error.message;
    return false;
  } finally {
    setSaving(product.id, false);
  }
}

async function confirmRestock() {
  if (!restockTargetProduct.value) {
    return;
  }

  const qty = Number(restockInputs[restockTargetProduct.value.id] || 0);
  const success = await restockProduct(restockTargetProduct.value, qty);
  showRestockConfirmModal.value = false;
  if (success) {
    closeRestockModal();
  }
}

onMounted(loadProducts);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Inventory</p>
      <h1>Inventory Restock</h1>
      <p class="sub">Monitor stock levels and quickly restock low products.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section class="list-panel">
      <h2>Products</h2>
      <p class="low-stock" :class="{ warning: lowStockCount > 0 }">
        Low Stock Items (below 20): {{ lowStockCount }}
      </p>

      <div class="filters-row">
        <input
          v-model="searchText"
          type="text"
          class="product-search"
          placeholder="Search product name, size, length, stock"
        />

        <select v-model="stockSort" class="stock-sort">
          <option value="none">Sort: Default</option>
          <option value="low-high">Stock: Lowest to Highest</option>
          <option value="high-low">Stock: Highest to Lowest</option>
        </select>
      </div>

      <p v-if="loading" class="muted">Loading products...</p>
      <p v-else-if="!products.length" class="muted">No products yet.</p>
      <p v-else-if="!sortedProducts.length" class="muted">No matching products.</p>

      <div v-else class="products-grid">
        <article v-for="product in sortedProducts" :key="product.id" class="product-card">
          <img v-if="product.productImagePath" :src="toImageUrl(product.productImagePath)" alt="Product" class="product-image" />
          <div v-else class="product-image placeholder">No Image</div>

          <div class="details">
            <h3>{{ product.productName }}</h3>
            <p class="meta">{{ product.size }} • {{ product.lengthCm ?? 'N/A' }} cm</p>
            <p class="description">{{ withLongDots(product.description || product.productDescription) }}</p>
            <p class="stock" :class="{ warning: Number(product.stockQuantity) < 20 }">
              Stock: {{ product.stockQuantity }}
            </p>
          </div>

          <div class="restock-actions">
            <button
              type="button"
              class="restock-btn"
              :disabled="isSaving(product.id)"
              @click="openRestockModal(product)"
            >
              {{ isSaving(product.id) ? 'Saving...' : 'Restock' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="showRestockModal && restockTargetProduct"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm restock"
      @click.self="closeRestockModal"
    >
      <section class="modal-card">
        <header class="modal-head">
          <h3>Restock Product</h3>
          <button type="button" class="restock-btn ghost" @click="closeRestockModal">Close</button>
        </header>

        <div class="modal-product">
          <img
            v-if="restockTargetProduct.productImagePath"
            :src="toImageUrl(restockTargetProduct.productImagePath)"
            alt="Product"
            class="modal-product-image"
          />
          <div class="modal-product-meta">
            <p class="modal-line"><strong>{{ restockTargetProduct.productName }}</strong></p>
            <p class="modal-line">{{ restockTargetProduct.size }} • {{ restockTargetProduct.lengthCm ?? 'N/A' }} cm</p>
            <p class="modal-line">{{ withLongDots(restockTargetProduct.description || restockTargetProduct.productDescription, 78) }}</p>
            <p class="modal-line">Current Stock: {{ loadingModalStock ? 'Loading latest stock...' : restockTargetProduct.stockQuantity }}</p>
          </div>
        </div>

        <label class="restock-label" for="restockQtyInput">Quantity to add</label>
        <input
          id="restockQtyInput"
          v-model.number="restockInputs[restockTargetProduct.id]"
          type="number"
          min="1"
          step="1"
          class="restock-input modal-input"
          placeholder="Enter quantity"
          :disabled="isSaving(restockTargetProduct.id)"
        />
        <p class="modal-line">Projected Stock: {{ projectedStock }}</p>

        <footer class="modal-actions">
          <button type="button" class="restock-btn ghost" @click="closeRestockModal">Cancel</button>
          <button
            type="button"
            class="restock-btn"
            :disabled="isSaving(restockTargetProduct.id) || loadingModalStock"
            @click="requestRestockConfirmation"
          >
            Continue
          </button>
        </footer>
      </section>
    </div>

    <ConfirmationModal
      :visible="showRestockConfirmModal"
      title="Confirm Restock"
      :message="confirmationMessage"
      confirm-label="Yes, Restock"
      cancel-label="Back"
      @cancel="closeRestockConfirmation"
      @confirm="confirmRestock"
    />
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
  color: #c9ffd5;
}

.list-panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
}

.list-panel h2 {
  margin: 0;
}

.low-stock {
  margin-top: 0.5rem;
  color: #d8fff1;
  font-weight: 700;
}

.low-stock.warning {
  color: #ffd4ad;
}

.product-search {
  width: 100%;
  border: 1px solid rgba(133, 229, 197, 0.35);
  border-radius: 999px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  padding: 0.52rem 0.8rem;
  font: inherit;
}

.filters-row {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 0.5rem;
}

.stock-sort {
  border: 1px solid rgba(133, 229, 197, 0.35);
  border-radius: 999px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  padding: 0.52rem 0.75rem;
  font: inherit;
}

.muted {
  color: #c2f7e0;
  margin-top: 0.65rem;
}

.products-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.product-card {
  border: 1px solid rgba(126, 223, 192, 0.32);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.72);
  padding: 0.6rem;
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 0.65rem;
  align-items: center;
}

.product-image {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.product-image.placeholder {
  display: grid;
  place-items: center;
  color: #d5fff0;
  background: rgba(5, 27, 37, 0.75);
}

.details h3 {
  margin: 0;
  color: #e6fff4;
  font-size: 0.98rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.details {
  min-width: 0;
}

.details .meta {
  margin: 0.2rem 0 0;
  color: #bde8d8;
  font-size: 0.76rem;
}

.details .description {
  margin: 0.14rem 0 0;
  color: #d7fff1;
  font-size: 0.76rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

.details .stock {
  margin: 0.18rem 0 0;
  color: #d2ffef;
  font-size: 0.82rem;
}

.details .stock.warning {
  color: #ffd4ad;
  font-weight: 800;
}

.restock-actions {
  margin-top: 0;
  display: flex;
  justify-self: end;
}

.restock-input {
  width: 100%;
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 8px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  text-align: center;
  padding: 0.3rem;
  font: inherit;
}

.restock-btn {
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 8px;
  background: #0f7058;
  color: #ecfff7;
  padding: 0.4rem 0.62rem;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  width: auto;
  white-space: nowrap;
}

.restock-btn.ghost {
  background: transparent;
  width: auto;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(2, 9, 16, 0.72);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.modal-card {
  width: min(460px, 100%);
  border: 1px solid rgba(123, 225, 191, 0.4);
  border-radius: 14px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.96), rgba(9, 59, 71, 0.92));
  padding: 0.9rem;
}

.modal-product {
  margin-top: 0.65rem;
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 0.6rem;
}

.modal-product-image {
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(133, 229, 197, 0.35);
}

.modal-product-meta {
  min-width: 0;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.modal-head h3 {
  margin: 0;
}

.modal-line {
  margin: 0.45rem 0 0;
  color: #d2ffef;
}

.modal-actions {
  margin-top: 0.85rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}

.modal-input {
  margin-top: 0.32rem;
}

.restock-label {
  display: block;
  margin-top: 0.75rem;
  color: #d5fff1;
  font-size: 0.82rem;
  font-weight: 700;
}

@media (max-width: 640px) {
  .filters-row {
    grid-template-columns: 1fr;
  }

  .product-card {
    grid-template-columns: 68px 1fr auto;
    gap: 0.5rem;
  }

  .product-image {
    width: 68px;
    height: 68px;
  }

  .modal-product {
    grid-template-columns: 1fr;
  }

  .modal-product-image {
    width: 100%;
    height: 120px;
  }
}

@media (max-width: 420px) {
  .product-card {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .product-image {
    width: 100%;
    height: 120px;
  }

  .restock-actions {
    justify-self: end;
  }
}
</style>
