<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
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
import { loadPhAddressData, normalizeByName } from '../../services/phAddress';
import { getUser } from '../../services/session';
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
const loadingPhAddress = ref(false);
const regions = ref([]);
const provinces = ref([]);
const cities = ref([]);
const barangays = ref([]);

const checkoutForm = reactive({
  fullName: '',
  contactNumber: '',
  streetAddress: '',
  regionCode: '',
  provinceCode: '',
  cityCode: '',
  barangayCode: '',
  paymentMethod: 'cash_on_delivery',
  deliveryNotes: '',
});

const filteredProvinces = computed(() => {
  if (!checkoutForm.regionCode) return [];
  return normalizeByName(
    provinces.value.filter((province) => String(province.region_code) === String(checkoutForm.regionCode)),
    'province_name'
  );
});

const filteredCities = computed(() => {
  if (!checkoutForm.provinceCode) return [];
  return normalizeByName(
    cities.value.filter((city) => String(city.province_code) === String(checkoutForm.provinceCode)),
    'city_name'
  );
});

const filteredBarangays = computed(() => {
  if (!checkoutForm.cityCode) return [];
  return normalizeByName(
    barangays.value.filter((barangay) => String(barangay.city_code) === String(checkoutForm.cityCode)),
    'brgy_name'
  );
});

const orderCount = computed(() => orders.value.length);

function withTrailingDots(value, maxLength = 44) {
  const text = String(value || '').trim();
  if (!text) return 'No description yet.';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}.............`;
}

function traderInitial(name) {
  const normalized = String(name || 'T').trim();
  return (normalized[0] || 'T').toUpperCase();
}

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function totalCartQuantity() {
  return cartItems.value.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function getSelectedRegion() {
  return regions.value.find((region) => String(region.region_code) === String(checkoutForm.regionCode)) || null;
}

function getSelectedProvince() {
  return provinces.value.find((province) => String(province.province_code) === String(checkoutForm.provinceCode)) || null;
}

function getSelectedCity() {
  return cities.value.find((city) => String(city.city_code) === String(checkoutForm.cityCode)) || null;
}

function getSelectedBarangay() {
  return barangays.value.find((barangay) => String(barangay.brgy_code) === String(checkoutForm.barangayCode)) || null;
}

function onRegionChange() {
  checkoutForm.provinceCode = '';
  checkoutForm.cityCode = '';
  checkoutForm.barangayCode = '';
}

function onProvinceChange() {
  checkoutForm.cityCode = '';
  checkoutForm.barangayCode = '';
}

function onCityChange() {
  checkoutForm.barangayCode = '';
}

async function loadPhAddressSelectors() {
  loadingPhAddress.value = true;
  try {
    const data = await loadPhAddressData();
    regions.value = normalizeByName(data.regions || [], 'region_name');
    provinces.value = data.provinces || [];
    cities.value = data.cities || [];
    barangays.value = data.barangays || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loadingPhAddress.value = false;
  }
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
  const selectedRegion = getSelectedRegion();
  const selectedProvince = getSelectedProvince();
  const selectedCity = getSelectedCity();
  const selectedBarangay = getSelectedBarangay();

  if (!cartItems.value.length) {
    feedback.value = 'Your cart is empty.';
    return;
  }

  if (
    !checkoutForm.fullName.trim() ||
    !checkoutForm.contactNumber.trim() ||
    !checkoutForm.streetAddress.trim() ||
    !selectedRegion ||
    !selectedProvince ||
    !selectedCity ||
    !selectedBarangay
  ) {
    feedback.value = 'Please complete full name, contact number, and full delivery address before checkout.';
    return;
  }

  try {
    await placeMyOrder({
      fullName: checkoutForm.fullName.trim(),
      contactNumber: checkoutForm.contactNumber.trim(),
      streetAddress: checkoutForm.streetAddress.trim(),
      regionName: selectedRegion.region_name,
      provinceName: selectedProvince.province_name,
      cityName: selectedCity.city_name,
      barangayName: selectedBarangay.brgy_name,
      paymentMethod: 'cash_on_delivery',
      deliveryNotes: checkoutForm.deliveryNotes.trim(),
    });

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
  const currentUser = getUser() || {};
  checkoutForm.fullName = String(currentUser.fullName || currentUser.profileName || '').trim();
  checkoutForm.contactNumber = String(currentUser.contactNumber || '').trim();

  await loadPhAddressSelectors();
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
        My Cart ({{ totalCartQuantity() }})
      </button>
      <button type="button" :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">
        Orders ({{ orderCount }})
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

      <div v-else :class="['products', 'inventory-products', { 'single-item': products.length === 1 }]">
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
          <img
            v-if="trader.profileImagePath"
            :src="toImageUrl(trader.profileImagePath)"
            :alt="`${trader.name || 'Trader'} profile`"
            class="trader-avatar"
          />
          <div v-else class="trader-avatar placeholder">{{ traderInitial(trader.name) }}</div>
          <h3>{{ trader.name || 'Trader' }}</h3>
          <p class="desc" :title="trader.description || 'No description yet.'">
            {{ withTrailingDots(trader.description) }}
          </p>
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

      <div v-else class="checkout-wrap">
        <h3 class="checkout-title">Checkout Details</h3>
        <p v-if="loadingPhAddress" class="muted">Loading Philippine address selectors...</p>

        <form class="checkout-form" @submit.prevent="checkoutCart">
          <label>
            Full Name
            <input v-model="checkoutForm.fullName" type="text" placeholder="Receiver full name" required />
          </label>

          <label>
            Contact Number
            <input v-model="checkoutForm.contactNumber" type="text" placeholder="09xxxxxxxxx" required />
          </label>

          <label>
            Region
            <select v-model="checkoutForm.regionCode" required @change="onRegionChange">
              <option disabled value="">Select region</option>
              <option v-for="region in regions" :key="region.region_code" :value="region.region_code">
                {{ region.region_name }}
              </option>
            </select>
          </label>

          <label>
            Province
            <select v-model="checkoutForm.provinceCode" required @change="onProvinceChange">
              <option disabled value="">Select province</option>
              <option
                v-for="province in filteredProvinces"
                :key="province.province_code"
                :value="province.province_code"
              >
                {{ province.province_name }}
              </option>
            </select>
          </label>

          <label>
            City / Municipality
            <select v-model="checkoutForm.cityCode" required @change="onCityChange">
              <option disabled value="">Select city/municipality</option>
              <option v-for="city in filteredCities" :key="city.city_code" :value="city.city_code">
                {{ city.city_name }}
              </option>
            </select>
          </label>

          <label>
            Barangay
            <select v-model="checkoutForm.barangayCode" required>
              <option disabled value="">Select barangay</option>
              <option v-for="barangay in filteredBarangays" :key="barangay.brgy_code" :value="barangay.brgy_code">
                {{ barangay.brgy_name }}
              </option>
            </select>
          </label>

          <label class="full-width">
            Street / Unit / Landmark
            <input v-model="checkoutForm.streetAddress" type="text" placeholder="House No., street, landmark" required />
          </label>

          <label>
            Payment Method
            <input v-model="checkoutForm.paymentMethod" type="text" disabled />
          </label>

          <label class="full-width">
            Delivery Notes
            <textarea
              v-model="checkoutForm.deliveryNotes"
              rows="3"
              placeholder="Notes for rider (optional): nearest landmark, gate color, preferred call/text"
            ></textarea>
          </label>

          <div class="full-width">
            <button type="submit" class="checkout-btn">Place COD Order</button>
          </div>
        </form>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Trader</th>
                <th>Size</th>
                <th>Length</th>
                <th>Qty</th>
                <th>Stock Left</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in cartItems" :key="item.id">
                <td>{{ item.productName }}</td>
                <td>{{ item.traderName }}</td>
                <td>{{ item.size }}</td>
                <td>{{ item.lengthCm ?? 'N/A' }} cm</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.stockQuantity }}</td>
                <td>
                  <button type="button" class="mini-btn danger" @click="removeItemFromCart(item.id)">
                    Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section v-if="activeTab === 'orders'" class="list-panel">
      <h2>My Orders ({{ orderCount }})</h2>
      <p v-if="loadingOrders" class="muted">Loading orders...</p>
      <p v-else-if="!orders.length" class="muted">No orders yet.</p>

      <div v-else class="table-wrap">
        <table class="data-table orders-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Status</th>
              <th>Full Name</th>
              <th>Contact</th>
              <th>Address</th>
              <th>Payment</th>
              <th>Delivery Notes</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ order.id }}</td>
              <td>{{ new Date(order.createdAt).toLocaleString() }}</td>
              <td>
                <span class="badge">{{ order.status }}</span>
              </td>
              <td>{{ order.customerFullName || '-' }}</td>
              <td>{{ order.customerContactNumber || '-' }}</td>
              <td>{{ order.deliveryFullAddress || '-' }}</td>
              <td>{{ order.paymentMethod || 'cash_on_delivery' }}</td>
              <td>{{ order.deliveryNotes || '-' }}</td>
              <td>
                <p v-for="item in order.items" :key="item.id" class="order-item-line">
                  {{ item.productName }} ({{ item.size }}) x {{ item.quantity }} | {{ item.traderName }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
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
select,
textarea {
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

.inventory-products {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.inventory-products.single-item .product-card {
  grid-column: 1 / -1;
}

.product-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.65);
  padding: 0.6rem;
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 0.55rem;
  align-content: start;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.trader-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 14px;
  background: rgba(9, 34, 46, 0.66);
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.trader-avatar {
  width: 100%;
  height: clamp(60px, 18vw, 120px);
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(133, 229, 197, 0.35);
}

.trader-avatar.placeholder {
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, rgba(19, 92, 76, 0.72), rgba(15, 66, 108, 0.72));
  color: #d8fff1;
  font-weight: 900;
  font-size: clamp(1rem, 4vw, 1.5rem);
}

.trader-card h3 {
  margin: 0;
  margin-top: 0.42rem;
  font-size: 0.86rem;
  line-height: 1.2;
}

.desc {
  margin: 0.4rem 0 0;
  color: #d4fff0;
  font-size: 0.76rem;
  line-height: 1.2;
  min-height: 2.4em;
  overflow: hidden;
}

.meta {
  margin: 0.18rem 0 0;
  color: #c5f9e5;
  font-size: 0.72rem;
}

.actions {
  margin-top: auto;
  padding-top: 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mini-btn {
  margin-top: 0;
  border: 1px solid rgba(133, 229, 197, 0.55);
  border-radius: 10px;
  background: #1f67a8;
  color: #ecfff7;
  padding: 0.4rem 0.45rem;
  font-weight: 700;
  font-size: 0.7rem;
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

.checkout-wrap {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.9rem;
}

.checkout-title {
  margin: 0;
  font-size: 1rem;
}

.checkout-form {
  border: 1px solid rgba(126, 223, 192, 0.35);
  border-radius: 14px;
  background: rgba(4, 28, 39, 0.62);
  padding: 0.8rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.full-width {
  grid-column: 1 / -1;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(126, 223, 192, 0.26);
  border-radius: 14px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
  background: rgba(7, 29, 40, 0.6);
}

.data-table th,
.data-table td {
  border-bottom: 1px solid rgba(126, 223, 192, 0.22);
  padding: 0.55rem 0.6rem;
  text-align: left;
  font-size: 0.8rem;
  vertical-align: top;
}

.data-table th {
  color: #d9fff0;
  background: rgba(10, 56, 71, 0.7);
  font-weight: 800;
}

.order-item-line {
  margin: 0;
  color: #d2ffef;
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

@media (max-width: 560px) {
  .checkout-form {
    grid-template-columns: 1fr;
  }

  .product-card {
    grid-template-columns: 1fr;
  }

  .product-card img {
    width: 100%;
    height: 120px;
  }
}
</style>
