<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addCartItem, fetchMarketplaceTraders } from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getUser } from '../../services/session';

const route = useRoute();
const router = useRouter();
const traders = ref([]);
const loading = ref(false);
const feedback = ref('');
const search = ref('');
const sizeFilter = ref('all');
const selectedProduct = ref(null);
const selectedTraderName = ref('');
const selectedQuantity = ref(1);
const modalSubmitting = ref(false);
const imagePreviewUrl = ref('');

const currentUserId = computed(() => Number(getUser()?.id || 0));

function isCurrentTraderId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed === currentUserId.value;
}

function sanitizeTraderRows(rows) {
  return (rows || [])
    .filter((trader) => !isCurrentTraderId(trader?.traderId))
    .map((trader) => {
      const products = (trader.products || []).filter((product) => {
        const ownerId = Number(
          product?.traderId
          || product?.userId
          || product?.ownerId
          || product?.sellerId
          || trader?.traderId
          || 0
        );

        return !isCurrentTraderId(ownerId);
      });

      return {
        ...trader,
        products,
        totalSoldQuantity: products.reduce((sum, product) => sum + Number(product.totalSoldQuantity || 0), 0),
        averageRating: (() => {
          const weighted = products.reduce((acc, product) => {
            const rating = Number(product.averageRating || 0);
            const ratingCount = Number(product.ratingCount || 0);
            if (ratingCount <= 0 || !Number.isFinite(rating)) {
              return acc;
            }

            return {
              ratingTotal: acc.ratingTotal + (rating * ratingCount),
              countTotal: acc.countTotal + ratingCount,
            };
          }, { ratingTotal: 0, countTotal: 0 });

          if (!weighted.countTotal) {
            return null;
          }

          return Number((weighted.ratingTotal / weighted.countTotal).toFixed(1));
        })(),
      };
    })
    .filter((trader) => (trader.products || []).length > 0);
}

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function messageTrader(trader) {
  const traderId = Number(trader?.traderId || 0);
  if (!Number.isInteger(traderId) || traderId <= 0) {
    feedback.value = 'Invalid trader selected.';
    return;
  }

  if (isCurrentTraderId(traderId)) {
    feedback.value = 'You cannot message your own account.';
    return;
  }

  router.push({
    name: 'trader-messages',
    query: {
      traderId: String(traderId),
      traderName: String(trader?.name || 'Trader'),
    },
  });
}

function openProductModal(product, trader) {
  selectedProduct.value = product;
  selectedTraderName.value = trader?.name || 'Trader';
  selectedQuantity.value = 1;
}

function closeProductModal() {
  selectedProduct.value = null;
  selectedTraderName.value = '';
  selectedQuantity.value = 1;
  modalSubmitting.value = false;
  imagePreviewUrl.value = '';
}

function openImagePreview(imagePath) {
  const imageUrl = toImageUrl(imagePath);
  if (!imageUrl) return;
  imagePreviewUrl.value = imageUrl;
}

function closeImagePreview() {
  imagePreviewUrl.value = '';
}

function decreaseModalQuantity() {
  selectedQuantity.value = Math.max(1, Number(selectedQuantity.value || 1) - 1);
}

function increaseModalQuantity() {
  const stock = Number(selectedProduct.value?.stockQuantity || 0);
  selectedQuantity.value = Math.min(stock, Number(selectedQuantity.value || 1) + 1);
}

function onModalQuantityInput(event) {
  const stock = Number(selectedProduct.value?.stockQuantity || 0);
  const inputValue = Number(event.target.value);

  if (!Number.isInteger(inputValue) || inputValue <= 0) {
    selectedQuantity.value = 1;
    event.target.value = 1;
    return;
  }

  const normalizedValue = Math.min(inputValue, Math.max(1, stock));
  selectedQuantity.value = normalizedValue;
  event.target.value = normalizedValue;
}

async function addToCart(productId, quantity) {
  try {
    const data = await addCartItem({ productId, quantity });
    feedback.value = 'Product added to cart.';
    return data;
  } catch (error) {
    feedback.value = error.message;
    return null;
  }
}

async function addSelectedProductToCart() {
  const product = selectedProduct.value;
  if (!product) return;

  const quantity = Number(selectedQuantity.value || 1);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    feedback.value = 'Quantity must be a positive whole number.';
    return;
  }

  if (quantity > Number(product.stockQuantity || 0)) {
    feedback.value = `Only ${product.stockQuantity} stock available.`;
    return;
  }

  modalSubmitting.value = true;
  try {
    await addToCart(product.id, quantity);
    closeProductModal();
  } finally {
    modalSubmitting.value = false;
  }
}

async function buyNowSelectedProduct() {
  const product = selectedProduct.value;
  if (!product) return;

  const quantity = Number(selectedQuantity.value || 1);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    feedback.value = 'Quantity must be a positive whole number.';
    return;
  }

  if (quantity > Number(product.stockQuantity || 0)) {
    feedback.value = `Only ${product.stockQuantity} stock available.`;
    return;
  }

  modalSubmitting.value = true;
  try {
    const data = await addToCart(product.id, quantity);
    const cartItemId = Number(data?.cartItemId || 0);
    closeProductModal();

    router.push({
      name: 'trader-marketplace',
      query: cartItemId > 0
        ? { tab: 'cart', selectCartItemId: String(cartItemId) }
        : { tab: 'cart' },
    });
  } finally {
    modalSubmitting.value = false;
  }
}

async function loadMarketplace() {
  loading.value = true;
  try {
    const data = await fetchMarketplaceTraders();
    traders.value = sanitizeTraderRows(data.traders || []);
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

const selectedTraderId = computed(() => {
  const raw = Number(route.query.traderId);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
});

const filteredTraders = computed(() => {
  const keyword = search.value.trim().toLowerCase();

  return traders.value
    .filter((trader) => {
      if (selectedTraderId.value && trader.traderId !== selectedTraderId.value) {
        return false;
      }

      const filteredProducts = (trader.products || []).filter((product) => {
        if (sizeFilter.value !== 'all' && product.size !== sizeFilter.value) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        const searchText = [
          trader.name,
          trader.description,
          trader.businessAddress,
          product.productName,
          product.size,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchText.includes(keyword);
      });

      return filteredProducts.length > 0;
    })
    .map((trader) => ({
      ...trader,
      products: (trader.products || []).filter((product) => {
        if (sizeFilter.value !== 'all' && product.size !== sizeFilter.value) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        const searchText = [
          trader.name,
          trader.description,
          trader.businessAddress,
          product.productName,
          product.size,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchText.includes(keyword);
      }),
    }));
});

function clearTraderFilter() {
  router.push({ name: 'trader-browse-products' });
}

function isFocusedTrader(trader) {
  return selectedTraderId.value === trader.traderId;
}

function getVisibleProducts(trader) {
  if (isFocusedTrader(trader)) {
    return trader.products || [];
  }

  return (trader.products || []).slice(0, 2);
}

function focusTraderProducts(traderId) {
  router.push({ name: 'trader-browse-products', query: { traderId: String(traderId) } });
}

onMounted(loadMarketplace);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Marketplace</p>
      <h1>Browse Products</h1>
      <p class="sub">Search all trader products, message traders, and add items to cart.</p>
    </header>

    <section class="filters">
      <label>
        Search
        <input v-model="search" type="text" placeholder="Search trader, product, address" />
      </label>

      <label>
        Size
        <select v-model="sizeFilter">
          <option value="all">All sizes</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
    </section>

    <button v-if="selectedTraderId" type="button" class="clear-btn" @click="clearTraderFilter">
      Show All Traders
    </button>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section class="list-panel">
      <h2>All Traders & Products</h2>
      <p v-if="loading" class="muted">Loading products...</p>
      <p v-else-if="!filteredTraders.length" class="muted">No products matched your filters.</p>

      <div v-else class="traders-grid">
        <article v-for="trader in filteredTraders" :key="trader.traderId" class="trader-card">
          <div class="trader-head">
            <h3>{{ trader.name || 'Trader' }}</h3>
            <button type="button" class="msg-btn" @click="messageTrader(trader)">Message Trader</button>
          </div>

          <p class="desc">{{ trader.description || 'No description yet.' }}</p>
          <p class="meta">Total Products: {{ trader.totalProducts }}</p>
          <p class="meta">Total Sold: {{ trader.totalSoldQuantity || 0 }}</p>
          <p class="meta">
            Average Rating:
            {{ trader.averageRating ? `${trader.averageRating}/5` : 'No ratings yet' }}
          </p>
          <p class="meta">Contact: {{ trader.contactNumber || 'N/A' }}</p>
          <p class="meta">Address: {{ trader.businessAddress || 'N/A' }}</p>

          <div :class="['products', { single: getVisibleProducts(trader).length === 1 }]">
            <article
              v-for="product in getVisibleProducts(trader)"
              :key="product.id"
              class="product-card clickable"
              @click="openProductModal(product, trader)"
            >
              <img v-if="product.productImagePath" :src="toImageUrl(product.productImagePath)" alt="Product" />
              <div>
                <h4>{{ product.productName }}</h4>
                <p>Size: {{ product.size }}</p>
                <p>Length: {{ product.lengthCm ?? 'N/A' }} cm</p>
                <p>Price: {{ formatCurrency(product.productPrice) }}</p>
                <p>Total Sold: {{ Number(product.totalSoldQuantity || 0) }}</p>
                <p>
                  Avg Rating:
                  {{ product.averageRating ? `${Number(product.averageRating).toFixed(1)}/5` : 'No ratings yet' }}
                </p>
                <button type="button" class="cart-btn" @click.stop="openProductModal(product, trader)">
                  View Product
                </button>
              </div>
            </article>
          </div>

          <button
            v-if="trader.products.length > 2 && !isFocusedTrader(trader)"
            type="button"
            class="view-more-btn"
            @click="focusTraderProducts(trader.traderId)"
          >
            View More
          </button>
        </article>
      </div>
    </section>

    <div
      v-if="selectedProduct"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Product details"
      @click.self="closeProductModal"
    >
      <section class="modal-card">
        <header class="modal-head">
          <h3>{{ selectedProduct.productName }}</h3>
          <button type="button" class="close-btn" @click="closeProductModal">Close</button>
        </header>

        <div class="modal-body">
          <img
            v-if="selectedProduct.productImagePath"
            :src="toImageUrl(selectedProduct.productImagePath)"
            :alt="selectedProduct.productName"
            class="modal-image"
            @click="openImagePreview(selectedProduct.productImagePath)"
          />
          <div v-else class="modal-image placeholder">No Image</div>

          <div class="modal-info">
            <p>Trader: {{ selectedTraderName }}</p>
            <p>Size: {{ selectedProduct.size }}</p>
            <p>Length: {{ selectedProduct.lengthCm ?? 'N/A' }} cm</p>
            <p>Price: {{ formatCurrency(selectedProduct.productPrice) }}</p>
            <p>Total Sold: {{ Number(selectedProduct.totalSoldQuantity || 0) }}</p>
            <p>
              Average Rating:
              {{ selectedProduct.averageRating ? `${Number(selectedProduct.averageRating).toFixed(1)}/5` : 'No ratings yet' }}
            </p>
            <p class="stock-left">Stocks Left: {{ selectedProduct.stockQuantity }}</p>

            <div class="qty-controls">
              <button
                type="button"
                class="qty-btn"
                :disabled="modalSubmitting || Number(selectedQuantity) <= 1"
                @click="decreaseModalQuantity"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                step="1"
                class="qty-input"
                :max="selectedProduct.stockQuantity"
                :value="selectedQuantity"
                :disabled="modalSubmitting"
                @change="onModalQuantityInput"
              />
              <button
                type="button"
                class="qty-btn"
                :disabled="modalSubmitting || Number(selectedQuantity) >= Number(selectedProduct.stockQuantity)"
                @click="increaseModalQuantity"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <footer class="modal-actions">
          <button
            type="button"
            class="modal-btn cart"
            :disabled="modalSubmitting || Number(selectedProduct.stockQuantity) <= 0"
            @click="addSelectedProductToCart"
          >
            {{ Number(selectedProduct.stockQuantity) <= 0 ? 'Out of Stock' : 'Add to Cart' }}
          </button>
          <button
            type="button"
            class="modal-btn buy"
            :disabled="modalSubmitting || Number(selectedProduct.stockQuantity) <= 0"
            @click="buyNowSelectedProduct"
          >
            Buy Now
          </button>
        </footer>
      </section>
    </div>

    <div
      v-if="imagePreviewUrl"
      class="image-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      @click.self="closeImagePreview"
    >
      <section class="image-preview-card">
        <button type="button" class="close-btn" @click="closeImagePreview">Close</button>
        <img :src="imagePreviewUrl" alt="Product preview" class="image-preview" />
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

.filters,
.list-panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
}

.filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr);
  gap: 0.7rem;
  align-items: end;
}

label {
  display: grid;
  gap: 0.3rem;
  color: #d6fff1;
  font-weight: 700;
}

input,
select {
  width: 100%;
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 10px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
  padding: 0.62rem 0.7rem;
  font: inherit;
}

.clear-btn {
  margin-top: 0.75rem;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #1e5ea4;
  color: #ecfff7;
  padding: 0.6rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.feedback {
  margin-top: 0.8rem;
  color: #c9ffd5;
}

.list-panel h2 {
  margin: 0;
}

.muted {
  color: #c2f7e0;
  margin-top: 0.65rem;
}

.traders-grid {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.85rem;
}

.trader-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 14px;
  background: rgba(9, 34, 46, 0.66);
  padding: 0.85rem;
}

.trader-head {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  align-items: center;
}

.trader-head h3 {
  margin: 0;
}

.msg-btn {
  border: 1px solid rgba(146, 146, 255, 0.55);
  border-radius: 10px;
  background: #5f58c7;
  color: #f2efff;
  padding: 0.5rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.desc {
  margin: 0.4rem 0 0;
  color: #d4fff0;
}

.meta {
  margin: 0.24rem 0 0;
  color: #c5f9e5;
  font-size: 0.9rem;
}

.products {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.products.single {
  grid-template-columns: 1fr;
}

.product-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.65);
  padding: 0.55rem;
}

.product-card.clickable {
  cursor: pointer;
}

.product-card img {
  width: 100%;
  height: 92px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.product-card h4 {
  margin: 0.45rem 0 0;
  font-size: 0.9rem;
}

.product-card p {
  margin: 0.14rem 0 0;
  font-size: 0.8rem;
  color: #d2ffef;
}

.cart-btn {
  margin-top: 0.45rem;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #1f67a8;
  color: #ecfff7;
  padding: 0.42rem 0.6rem;
  width: 100%;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 9, 16, 0.7);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  width: min(720px, 100%);
  border: 1px solid rgba(123, 225, 191, 0.4);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.96), rgba(9, 59, 71, 0.92));
  padding: 0.95rem;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}

.modal-head h3 {
  margin: 0;
}

.close-btn {
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #245f9f;
  color: #ecfff7;
  padding: 0.35rem 0.62rem;
  font-weight: 700;
  cursor: pointer;
}

.modal-body {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 0.9rem;
}

.modal-image {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(131, 236, 200, 0.35);
  cursor: zoom-in;
}

.modal-image.placeholder {
  display: grid;
  place-items: center;
  color: #d5fff0;
  background: rgba(5, 27, 37, 0.75);
}

.modal-info p {
  margin: 0.22rem 0 0;
  color: #d2ffef;
}

.stock-left {
  margin-top: 0.45rem;
  font-weight: 800;
  color: #c9ffd5;
}

.qty-controls {
  margin-top: 0.7rem;
  display: inline-grid;
  grid-template-columns: 32px 64px 32px;
  align-items: center;
  gap: 0.24rem;
}

.qty-btn {
  height: 30px;
  padding: 0;
  line-height: 1;
  border-radius: 8px;
  font-weight: 900;
  background: #1f67a8;
  border: 1px solid rgba(133, 229, 197, 0.55);
  color: #ecfff7;
  cursor: pointer;
}

.qty-input {
  height: 30px;
  text-align: center;
  border: 1px solid rgba(133, 229, 197, 0.45);
  border-radius: 8px;
  background: rgba(5, 27, 37, 0.75);
  color: #ecfff7;
}

.modal-actions {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.modal-btn {
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  color: #ecfff7;
  padding: 0.55rem 0.72rem;
  font-weight: 800;
  cursor: pointer;
}

.modal-btn.cart {
  background: #1f67a8;
}

.modal-btn.buy {
  background: #0f7058;
}

.modal-btn:disabled,
.qty-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.image-preview-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 9, 16, 0.86);
  display: grid;
  place-items: center;
  z-index: 1100;
  padding: 1rem;
}

.image-preview-card {
  width: min(960px, 100%);
  display: grid;
  gap: 0.6rem;
  justify-items: end;
}

.image-preview {
  width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid rgba(131, 236, 200, 0.4);
  background: rgba(5, 27, 37, 0.85);
}

.cart-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.products.single .product-card img {
  height: 170px;
}

.view-more-btn {
  margin-top: 0.7rem;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #1e5ea4;
  color: #ecfff7;
  padding: 0.45rem 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

@media (min-width: 900px) {
  .filters {
    grid-template-columns: 2fr 1fr;
  }

  .products {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .products.single {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .filters {
    grid-template-columns: minmax(0, 2fr) minmax(110px, 1fr);
  }

  .product-card img {
    height: 84px;
  }

  .modal-body {
    grid-template-columns: 1fr;
  }

  .modal-image {
    height: 150px;
  }
}
</style>
