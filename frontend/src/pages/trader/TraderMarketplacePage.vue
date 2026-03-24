<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  createTraderProduct,
  fetchCartItems,
  fetchMarketplaceTraders,
  fetchMyOrders,
  fetchTraderProducts,
  placeMyOrder,
  removeCartItem,
} from '../../services/api';
import { toMediaUrl } from '../../services/media';
const router = useRouter();
const activeTab = ref('add-product');

const form = reactive({
  productName: '',
  size: 'small',
  lengthCm: '',
  stockQuantity: 0,
  productImage: null,
});

const products = ref([]);
const loadingProducts = ref(false);
const saving = ref(false);
const feedback = ref('');
const marketplace = ref([]);
const cartItems = ref([]);
const orders = ref([]);
const loadingMarketplace = ref(false);
const loadingCart = ref(false);
const loadingOrders = ref(false);

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function totalCartQuantity() {
  return cartItems.value.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

async function loadProducts() {
  loadingProducts.value = true;
  try {
    const data = await fetchTraderProducts();
    products.value = data.products || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loadingProducts.value = false;
  }
}

function onSelectImage(event) {
  const [file] = event.target.files || [];
  form.productImage = file || null;
}

async function loadMarketplace() {
  loadingMarketplace.value = true;
  try {
    const data = await fetchMarketplaceTraders();
    marketplace.value = data.traders || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loadingMarketplace.value = false;
  }
}

async function loadCart() {
  loadingCart.value = true;
  try {
    const data = await fetchCartItems();
    cartItems.value = data.items || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loadingCart.value = false;
  }
}

async function loadOrders() {
  loadingOrders.value = true;
  try {
    const data = await fetchMyOrders();
    orders.value = data.orders || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loadingOrders.value = false;
  }
}

function goToBrowseProducts(traderId) {
  const query = traderId ? { traderId: String(traderId) } : {};
  router.push({ name: 'trader-browse-products', query });
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

async function removeItemFromCart(itemId) {
  try {
    await removeCartItem(itemId);
    feedback.value = 'Item removed from cart.';
    await loadCart();
  } catch (error) {
    feedback.value = error.message;
  }
}

async function checkoutCart() {
  try {
    await placeMyOrder();
    feedback.value = 'Order placed successfully.';
    await Promise.all([loadCart(), loadOrders(), loadMarketplace(), loadProducts()]);
    activeTab.value = 'orders';
  } catch (error) {
    feedback.value = error.message;
  }
}

async function submitProduct() {
  feedback.value = '';
  saving.value = true;
  try {
    await createTraderProduct({ ...form });
    feedback.value = 'Product added successfully.';
    form.productName = '';
    form.size = 'small';
    form.lengthCm = '';
    form.stockQuantity = 0;
    form.productImage = null;
    await Promise.all([loadProducts(), loadMarketplace()]);
    activeTab.value = 'inventory';
  } catch (error) {
    feedback.value = error.message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadMarketplace(), loadCart(), loadOrders()]);
});
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Marketplace</p>
      <h1>Marketplace Hub</h1>
      <p class="sub">Manage inventory, browse traders, shop, and track orders.</p>
    </header>

    <nav class="tabs">
      <button type="button" :class="{ active: activeTab === 'add-product' }" @click="activeTab = 'add-product'">
        Add Product
      </button>
      <button type="button" :class="{ active: activeTab === 'inventory' }" @click="activeTab = 'inventory'">
        My Inventory
      </button>
      <button type="button" :class="{ active: activeTab === 'marketplace' }" @click="activeTab = 'marketplace'">
        Marketplace
      </button>
      <button type="button" :class="{ active: activeTab === 'cart' }" @click="activeTab = 'cart'">
        My Cart
      </button>
      <button type="button" :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">
        Orders
      </button>
    </nav>

    <form v-if="activeTab === 'add-product'" class="form" @submit.prevent="submitProduct">
      <label>
        Product Name
        <input v-model="form.productName" type="text" placeholder="Product name" required />
      </label>

      <label>
        Size
        <select v-model="form.size" required>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>

      <label>
        Length (cm)
        <input v-model="form.lengthCm" type="number" step="0.01" min="0" placeholder="Optional" />
      </label>

      <label>
        Stock Quantity
        <input v-model.number="form.stockQuantity" type="number" min="0" step="1" required />
      </label>

      <label>
        Product Image (optional)
        <input type="file" accept="image/*" @change="onSelectImage" />
      </label>

      <button type="submit" :disabled="saving">{{ saving ? 'Adding...' : 'Add Product' }}</button>
    </form>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section v-if="activeTab === 'inventory'" class="list-panel">
      <h2>Your Products</h2>
      <p v-if="loadingProducts" class="muted">Loading products...</p>
      <p v-else-if="!products.length" class="muted">No products yet.</p>

      <div v-else class="products">
        <article v-for="product in products" :key="product.id" class="product-card">
          <img v-if="product.productImagePath" :src="toImageUrl(product.productImagePath)" alt="Product" />
          <div>
            <h3>{{ product.productName }}</h3>
            <p>Size: {{ product.size }}</p>
            <p>Length: {{ product.lengthCm ?? 'N/A' }} cm</p>
            <p>Stock: {{ product.stockQuantity }}</p>
          </div>
        </article>
      </div>
    </section>

    <section v-if="activeTab === 'marketplace'" class="list-panel">
      <h2>All Traders</h2>
      <p v-if="loadingMarketplace" class="muted">Loading marketplace...</p>
      <p v-else-if="!marketplace.length" class="muted">No trader data available yet.</p>

      <div v-else class="traders-grid">
        <article v-for="trader in marketplace" :key="trader.traderId" class="trader-card">
          <h3>{{ trader.name || 'Trader' }}</h3>
          <p class="desc">{{ trader.description || 'No description yet.' }}</p>
          <p class="meta">Total Products: {{ trader.totalProducts }}</p>
          <p class="meta">Total Stocks: {{ trader.totalStocks }}</p>
          <p class="meta">Contact: {{ trader.contactNumber || 'N/A' }}</p>
          <p class="meta">Address: {{ trader.businessAddress || 'N/A' }}</p>

          <div class="actions">
            <button type="button" class="mini-btn" @click="goToBrowseProducts(trader.traderId)">
              View Products
            </button>
            <button type="button" class="mini-btn message" @click="messageTrader(trader)">
              Message
            </button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="activeTab === 'cart'" class="list-panel">
      <h2>My Cart ({{ totalCartQuantity() }})</h2>
      <p v-if="loadingCart" class="muted">Loading cart...</p>
      <p v-else-if="!cartItems.length" class="muted">Cart is empty.</p>

      <div v-else class="products">
        <article v-for="item in cartItems" :key="item.id" class="product-card">
          <img v-if="item.productImagePath" :src="toImageUrl(item.productImagePath)" alt="Product" />
          <div>
            <h4>{{ item.productName }}</h4>
            <p>Trader: {{ item.traderName }}</p>
            <p>Size: {{ item.size }}</p>
            <p>Length: {{ item.lengthCm ?? 'N/A' }} cm</p>
            <p>Qty: {{ item.quantity }}</p>
            <button type="button" class="mini-btn danger" @click="removeItemFromCart(item.id)">
              Remove
            </button>
          </div>
        </article>

        <button type="button" class="checkout-btn" @click="checkoutCart">Place Order</button>
      </div>
    </section>

    <section v-if="activeTab === 'orders'" class="list-panel">
      <h2>My Orders</h2>
      <p v-if="loadingOrders" class="muted">Loading orders...</p>
      <p v-else-if="!orders.length" class="muted">No orders yet.</p>

      <div v-else class="orders-grid">
        <article v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-head">
            <h3>Order #{{ order.id }}</h3>
            <span class="badge">{{ order.status }}</span>
          </div>
          <p class="meta">Created: {{ new Date(order.createdAt).toLocaleString() }}</p>

          <div class="order-items">
            <p v-for="item in order.items" :key="item.id">
              {{ item.productName }} ({{ item.size }}) x {{ item.quantity }} | {{ item.traderName }}
            </p>
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

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.tabs button {
  border: 1px solid rgba(126, 223, 192, 0.35);
  border-radius: 10px;
  background: rgba(8, 44, 57, 0.85);
  color: #dffef2;
  padding: 0.5rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.tabs button.active {
  background: #eaf6ef;
  color: #346f60;
}

.form,
.list-panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
}

.form {
  display: grid;
  gap: 0.8rem;
}

label {
  display: grid;
  gap: 0.32rem;
  font-weight: 700;
  color: #d5fff0;
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

button {
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #0a5e4b;
  color: #ecfff7;
  padding: 0.65rem 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
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

.products {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.75rem;
}

.product-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.65);
  padding: 0.7rem;
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 0.75rem;
}

.product-card img {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.product-card h3 {
  margin: 0;
  font-size: 1rem;
}

.product-card h4 {
  margin: 0;
  font-size: 0.98rem;
}

.product-card p {
  margin: 0.22rem 0 0;
  color: #d2ffef;
}

.traders-grid {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.8rem;
}

.trader-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 14px;
  background: rgba(9, 34, 46, 0.66);
  padding: 0.8rem;
}

.trader-card h3 {
  margin: 0;
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

.actions {
  margin-top: 0.7rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mini-btn {
  margin-top: 0.5rem;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #1f67a8;
  color: #ecfff7;
  padding: 0.5rem 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.mini-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.mini-btn.danger {
  background: #9a3346;
}

.mini-btn.message {
  background: #5f58c7;
}

.checkout-btn {
  border: 1px solid rgba(113, 221, 186, 0.6);
  border-radius: 10px;
  background: #0f7058;
  color: #eafff3;
  padding: 0.65rem 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.orders-grid {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.8rem;
}

.order-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 14px;
  background: rgba(9, 34, 46, 0.66);
  padding: 0.8rem;
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
}

.order-head h3 {
  margin: 0;
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

.order-items p {
  margin: 0.35rem 0 0;
  color: #d2ffef;
}

@media (max-width: 560px) {
  .product-card {
    grid-template-columns: 1fr;
  }

  .product-card img {
    width: 100%;
    height: 160px;
  }
}
</style>
