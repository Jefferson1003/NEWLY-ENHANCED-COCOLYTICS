<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addCartItem, fetchMarketplaceTraders } from '../../services/api';
import { toMediaUrl } from '../../services/media';

const route = useRoute();
const router = useRouter();
const traders = ref([]);
const loading = ref(false);
const feedback = ref('');
const search = ref('');
const sizeFilter = ref('all');

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function messageTrader(trader) {
  const rawNumber = String(trader.contactNumber || '').replace(/\D/g, '');
  if (!rawNumber) {
    feedback.value = 'This trader has no contact number yet.';
    return;
  }

  const international = rawNumber.startsWith('0') ? `63${rawNumber.slice(1)}` : rawNumber;
  const message = encodeURIComponent(`Hello ${trader.name || 'Trader'}, I want to ask about your products.`);
  window.open(`https://wa.me/${international}?text=${message}`, '_blank', 'noopener,noreferrer');
}

async function addToCart(productId) {
  try {
    await addCartItem({ productId, quantity: 1 });
    feedback.value = 'Product added to cart.';
  } catch (error) {
    feedback.value = error.message;
  }
}

async function loadMarketplace() {
  loading.value = true;
  try {
    const data = await fetchMarketplaceTraders();
    traders.value = data.traders || [];
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
          <p class="meta">Contact: {{ trader.contactNumber || 'N/A' }}</p>
          <p class="meta">Address: {{ trader.businessAddress || 'N/A' }}</p>

          <div :class="['products', { single: getVisibleProducts(trader).length === 1 }]">
            <article v-for="product in getVisibleProducts(trader)" :key="product.id" class="product-card">
              <img v-if="product.productImagePath" :src="toImageUrl(product.productImagePath)" alt="Product" />
              <div>
                <h4>{{ product.productName }}</h4>
                <p>Size: {{ product.size }}</p>
                <p>Length: {{ product.lengthCm ?? 'N/A' }} cm</p>
                <button
                  type="button"
                  class="cart-btn"
                  :disabled="product.stockQuantity <= 0"
                  @click="addToCart(product.id)"
                >
                  {{ product.stockQuantity <= 0 ? 'Out of Stock' : 'Add to Cart' }}
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
}
</style>
