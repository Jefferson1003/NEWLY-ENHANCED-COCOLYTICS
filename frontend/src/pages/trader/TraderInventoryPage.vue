<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { fetchTraderProducts, updateTraderProduct } from '../../services/api';
import { toMediaUrl } from '../../services/media';

const feedback = ref('');
const loading = ref(false);
const products = ref([]);
const restockInputs = reactive({});
const savingIds = ref([]);
const INVENTORY_UPDATED_EVENT = 'cocolytics-inventory-updated';

const lowStockCount = computed(() => {
  return products.value.filter((product) => Number(product.stockQuantity || 0) <= 10).length;
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

async function restockProduct(product) {
  const restockQty = Number(restockInputs[product.id] || 0);
  if (!Number.isInteger(restockQty) || restockQty <= 0) {
    feedback.value = 'Restock quantity must be a positive whole number.';
    return;
  }

  const nextStock = Number(product.stockQuantity || 0) + restockQty;

  setSaving(product.id, true);
  try {
    await updateTraderProduct(product.id, {
      productName: product.productName,
      size: product.size,
      lengthCm: product.lengthCm,
      stockQuantity: nextStock,
    });

    product.stockQuantity = nextStock;
    restockInputs[product.id] = 0;
    feedback.value = `${product.productName} restocked successfully.`;
    emitInventoryUpdated();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    setSaving(product.id, false);
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
        Low Stock Items (10 and below): {{ lowStockCount }}
      </p>

      <p v-if="loading" class="muted">Loading products...</p>
      <p v-else-if="!products.length" class="muted">No products yet.</p>

      <div v-else class="products-grid">
        <article v-for="product in products" :key="product.id" class="product-card">
          <img v-if="product.productImagePath" :src="toImageUrl(product.productImagePath)" alt="Product" class="product-image" />
          <div v-else class="product-image placeholder">No Image</div>

          <div class="details">
            <h3>{{ product.productName }}</h3>
            <p>Size: {{ product.size }}</p>
            <p>Length: {{ product.lengthCm ?? 'N/A' }} cm</p>
            <p class="stock" :class="{ warning: Number(product.stockQuantity) <= 10 }">
              Stock: {{ product.stockQuantity }}
            </p>
          </div>

          <div class="restock-actions">
            <input
              v-model.number="restockInputs[product.id]"
              type="number"
              min="0"
              step="1"
              class="restock-input"
              placeholder="Qty"
              :disabled="isSaving(product.id)"
            />
            <button
              type="button"
              class="restock-btn"
              :disabled="isSaving(product.id)"
              @click="restockProduct(product)"
            >
              {{ isSaving(product.id) ? 'Saving...' : 'Restock' }}
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

.muted {
  color: #c2f7e0;
  margin-top: 0.65rem;
}

.products-grid {
  margin-top: 0.8rem;
  display: grid;
  gap: 0.65rem;
}

.product-card {
  border: 1px solid rgba(126, 223, 192, 0.32);
  border-radius: 14px;
  background: rgba(5, 26, 36, 0.72);
  padding: 0.65rem;
  display: grid;
  grid-template-columns: 78px 1fr auto;
  gap: 0.65rem;
  align-items: center;
}

.product-image {
  width: 78px;
  height: 78px;
  object-fit: cover;
  border-radius: 10px;
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
}

.details p {
  margin: 0.2rem 0 0;
  color: #d2ffef;
}

.details .stock.warning {
  color: #ffd4ad;
  font-weight: 800;
}

.restock-actions {
  display: grid;
  gap: 0.4rem;
  justify-items: end;
}

.restock-input {
  width: 88px;
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 8px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  text-align: center;
  padding: 0.38rem;
  font: inherit;
}

.restock-btn {
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #0f7058;
  color: #ecfff7;
  padding: 0.45rem 0.7rem;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 640px) {
  .product-card {
    grid-template-columns: 64px 1fr;
    gap: 0.55rem;
  }

  .product-image {
    width: 64px;
    height: 64px;
  }

  .restock-actions {
    grid-column: 1 / -1;
    justify-items: stretch;
  }

  .restock-input {
    width: 100%;
  }
}
</style>
