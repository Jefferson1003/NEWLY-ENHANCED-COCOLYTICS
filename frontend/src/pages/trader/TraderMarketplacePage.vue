<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  createTraderProduct,
  fetchCartItems,
  fetchMarketplaceTraders,
  fetchMyOrders,
  fetchTraderProducts,
  placeMyOrder,
  removeCartItem,
  updateTraderProduct,
  updateCartItemQuantity as updateCartItemQuantityApi,
} from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getCheckoutAddress } from '../../services/checkoutAddress';
import { getUser } from '../../services/session';

const router = useRouter();
const route = useRoute();
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
const selectedCartItemIds = ref([]);
const currentAddress = ref(null);
const quantityUpdatingIds = ref([]);
const showCheckoutConfirmModal = ref(false);
const showProductEditModal = ref(false);
const editingProduct = ref(null);
const productSaving = ref(false);
const editProductForm = reactive({
  productName: '',
  size: 'small',
  lengthCm: '',
  stockQuantity: 0,
  productImage: null,
});

const orderCount = computed(() => orders.value.length);

const selectedCartItems = computed(() => {
  const selectedSet = new Set(selectedCartItemIds.value);
  return cartItems.value.filter((item) => selectedSet.has(item.id));
});

const groupedCartByTrader = computed(() => {
  const groups = new Map();

  for (const item of cartItems.value) {
    const traderName = String(item.traderName || 'Trader').trim() || 'Trader';

    if (!groups.has(traderName)) {
      groups.set(traderName, {
        traderName,
        items: [],
      });
    }

    groups.get(traderName).items.push(item);
  }

  return Array.from(groups.values())
    .sort((a, b) => a.traderName.localeCompare(b.traderName))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''))),
    }));
});

const selectedCartQuantity = computed(() => {
  return selectedCartItems.value.reduce((total, item) => total + Number(item.quantity || 0), 0);
});

const allCartItemsSelected = computed(() => {
  return cartItems.value.length > 0 && selectedCartItemIds.value.length === cartItems.value.length;
});

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

function cartItemDescription(item) {
  return withTrailingDots(`Size: ${item.size || 'N/A'} | Length: ${item.lengthCm ?? 'N/A'} cm | Qty: ${item.quantity}`, 58);
}

function refreshSavedAddress() {
  currentAddress.value = getCheckoutAddress();
}

function syncSelectedCartItems() {
  const validIds = new Set(cartItems.value.map((item) => item.id));
  selectedCartItemIds.value = selectedCartItemIds.value.filter((id) => validIds.has(id));
}

function isCartItemSelected(itemId) {
  return selectedCartItemIds.value.includes(itemId);
}

function toggleCartItemSelection(itemId) {
  if (isCartItemSelected(itemId)) {
    selectedCartItemIds.value = selectedCartItemIds.value.filter((id) => id !== itemId);
    return;
  }

  selectedCartItemIds.value = [...selectedCartItemIds.value, itemId];
}

function toggleAllCartSelections() {
  if (allCartItemsSelected.value) {
    selectedCartItemIds.value = [];
    return;
  }

  selectedCartItemIds.value = cartItems.value.map((item) => item.id);
}

function openAddressEditor() {
  router.push({ name: 'trader-address-editor' });
}

function formatOrderStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  return normalized.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatOrderDate(dateValue) {
  return new Date(dateValue).toLocaleString();
}

function openCheckoutConfirmation() {
  refreshSavedAddress();

  if (!cartItems.value.length) {
    feedback.value = 'Your cart is empty.';
    return;
  }

  if (!selectedCartItems.value.length) {
    feedback.value = 'Please select at least one cart item.';
    return;
  }

  const address = currentAddress.value;
  if (
    !address ||
    !address.fullName ||
    !address.contactNumber ||
    !address.streetAddress ||
    !address.regionName ||
    !address.provinceName ||
    !address.cityName ||
    !address.barangayName
  ) {
    feedback.value = 'Please save your delivery address first.';
    return;
  }

  showCheckoutConfirmModal.value = true;
}

function closeCheckoutConfirmation() {
  showCheckoutConfirmModal.value = false;
}

async function confirmCheckoutSelection() {
  if (!selectedCartItems.value.length) {
    feedback.value = 'Please keep at least one item selected to checkout.';
    return;
  }

  const success = await checkoutCart();
  if (success) {
    showCheckoutConfirmModal.value = false;
  }
}

function openProductFromCart(item) {
  router.push({
    name: 'trader-browse-products',
    query: {
      traderId: String(item.traderId),
      productId: String(item.productId),
    },
  });
}

function isQuantityUpdating(itemId) {
  return quantityUpdatingIds.value.includes(itemId);
}

function setQuantityUpdating(itemId, isUpdating) {
  if (isUpdating) {
    if (!quantityUpdatingIds.value.includes(itemId)) {
      quantityUpdatingIds.value = [...quantityUpdatingIds.value, itemId];
    }
    return;
  }

  quantityUpdatingIds.value = quantityUpdatingIds.value.filter((id) => id !== itemId);
}

async function updateCartItemQuantity(item, nextQuantity) {
  const normalizedQuantity = Number(nextQuantity);
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    feedback.value = 'Quantity must be a positive whole number.';
    return;
  }

  if (normalizedQuantity > Number(item.stockQuantity || 0)) {
    feedback.value = `Only ${item.stockQuantity} stock available for ${item.productName}.`;
    return;
  }

  if (normalizedQuantity === Number(item.quantity || 0)) {
    return;
  }

  setQuantityUpdating(item.id, true);
  try {
    await updateCartItemQuantityApi(item.id, normalizedQuantity);
    const targetItem = cartItems.value.find((cartItem) => cartItem.id === item.id);
    if (targetItem) {
      targetItem.quantity = normalizedQuantity;
    }
  } catch (error) {
    feedback.value = error.message;
  } finally {
    setQuantityUpdating(item.id, false);
  }
}

function onQuantityInputChange(item, event) {
  const requestedQuantity = Number(event.target.value);
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    event.target.value = item.quantity;
    feedback.value = 'Quantity must be a positive whole number.';
    return;
  }

  updateCartItemQuantity(item, requestedQuantity);
}

function decreaseCartItemQuantity(item) {
  updateCartItemQuantity(item, Number(item.quantity || 0) - 1);
}

function increaseCartItemQuantity(item) {
  updateCartItemQuantity(item, Number(item.quantity || 0) + 1);
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

function openEditProductModal(product) {
  editingProduct.value = product;
  editProductForm.productName = String(product.productName || '').trim();
  editProductForm.size = String(product.size || 'small').toLowerCase();
  editProductForm.lengthCm = product.lengthCm ?? '';
  editProductForm.stockQuantity = Number(product.stockQuantity || 0);
  editProductForm.productImage = null;
  showProductEditModal.value = true;
}

function closeEditProductModal() {
  showProductEditModal.value = false;
  editingProduct.value = null;
  editProductForm.productName = '';
  editProductForm.size = 'small';
  editProductForm.lengthCm = '';
  editProductForm.stockQuantity = 0;
  editProductForm.productImage = null;
}

function onSelectEditImage(event) {
  const [file] = event.target.files || [];
  editProductForm.productImage = file || null;
}

function emitInventoryUpdated() {
  window.dispatchEvent(new CustomEvent('cocolytics-inventory-updated'));
}

async function saveEditedProduct() {
  const product = editingProduct.value;
  if (!product) return;

  productSaving.value = true;
  try {
    await updateTraderProduct(product.id, {
      productName: editProductForm.productName,
      size: editProductForm.size,
      lengthCm: editProductForm.lengthCm,
      stockQuantity: editProductForm.stockQuantity,
      productImage: editProductForm.productImage,
    });

    feedback.value = 'Product updated successfully.';
    await Promise.all([loadProducts(), loadMarketplace()]);
    emitInventoryUpdated();
    closeEditProductModal();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    productSaving.value = false;
  }
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
    syncSelectedCartItems();
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
  refreshSavedAddress();

  if (!cartItems.value.length) {
    feedback.value = 'Your cart is empty.';
    return false;
  }

  if (!selectedCartItems.value.length) {
    feedback.value = 'Please select at least one cart item.';
    return false;
  }

  const address = currentAddress.value;
  if (
    !address ||
    !address.fullName ||
    !address.contactNumber ||
    !address.streetAddress ||
    !address.regionName ||
    !address.provinceName ||
    !address.cityName ||
    !address.barangayName
  ) {
    feedback.value = 'Please save your delivery address first.';
    return false;
  }

  try {
    await placeMyOrder({
      fullName: address.fullName,
      contactNumber: address.contactNumber,
      streetAddress: address.streetAddress,
      regionName: address.regionName,
      provinceName: address.provinceName,
      cityName: address.cityName,
      barangayName: address.barangayName,
      paymentMethod: 'cash_on_delivery',
      deliveryNotes: address.deliveryNotes || '',
      selectedCartItemIds: selectedCartItemIds.value,
    });

    feedback.value = 'Order placed successfully.';
    await Promise.all([loadCart(), loadOrders(), loadMarketplace(), loadProducts()]);
    activeTab.value = 'orders';
    return true;
  } catch (error) {
    feedback.value = error.message;
    return false;
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
  const requestedTab = String(route.query.tab || '').trim().toLowerCase();
  if (requestedTab === 'cart') {
    activeTab.value = 'cart';
  }

  if (String(route.query.addressSaved || '') === '1') {
    feedback.value = 'Address saved successfully.';
  }

  const currentUser = getUser() || {};
  if (!getCheckoutAddress()) {
    currentAddress.value = {
      fullName: String(currentUser.fullName || currentUser.profileName || '').trim(),
      contactNumber: String(currentUser.contactNumber || '').trim(),
      streetAddress: '',
      regionCode: '',
      regionName: '',
      provinceCode: '',
      provinceName: '',
      cityCode: '',
      cityName: '',
      barangayCode: '',
      barangayName: '',
      deliveryNotes: '',
      paymentMethod: 'cash_on_delivery',
    };
  }

  refreshSavedAddress();
  await Promise.all([loadProducts(), loadMarketplace(), loadCart(), loadOrders()]);

  const selectedCartItemIdFromQuery = Number(route.query.selectCartItemId);
  if (Number.isInteger(selectedCartItemIdFromQuery) && selectedCartItemIdFromQuery > 0) {
    const exists = cartItems.value.some((item) => item.id === selectedCartItemIdFromQuery);
    if (exists && !selectedCartItemIds.value.includes(selectedCartItemIdFromQuery)) {
      selectedCartItemIds.value = [...selectedCartItemIds.value, selectedCartItemIdFromQuery];
    }
  }
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
        <article
          v-for="product in products"
          :key="product.id"
          class="product-card clickable"
          @click="openEditProductModal(product)"
        >
          <img v-if="product.productImagePath" :src="toImageUrl(product.productImagePath)" alt="Product" />
          <div>
            <h3>{{ product.productName }}</h3>
            <p>Size: {{ product.size }}</p>
            <p>Length: {{ product.lengthCm ?? 'N/A' }} cm</p>
            <p>Stock: {{ product.stockQuantity }}</p>
            <button type="button" class="mini-btn" @click.stop="openEditProductModal(product)">Edit Product</button>
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
        <div class="cart-head-actions">
          <button type="button" class="mini-btn" @click="openAddressEditor">Address Editor</button>
          <button type="button" class="mini-btn" @click="toggleAllCartSelections">
            {{ allCartItemsSelected ? 'Unselect All' : 'Select All' }}
          </button>
        </div>

        <div class="address-preview" v-if="currentAddress">
          <h3 class="checkout-title">Delivery Address</h3>
          <p>
            {{ currentAddress.fullName || 'No name' }} | {{ currentAddress.contactNumber || 'No contact' }}
          </p>
          <p>
            {{ currentAddress.streetAddress || 'No street address' }},
            {{ currentAddress.barangayName || 'No barangay' }},
            {{ currentAddress.cityName || 'No city' }},
            {{ currentAddress.provinceName || 'No province' }},
            {{ currentAddress.regionName || 'No region' }}
          </p>
          <p>Delivery Notes: {{ currentAddress.deliveryNotes || 'None' }}</p>
          <p>Payment: Cash on Delivery</p>
        </div>

        <div class="cart-groups">
          <section v-for="group in groupedCartByTrader" :key="group.traderName" class="trader-group">
            <header class="trader-group-head">
              <h3>{{ group.traderName }}</h3>
            </header>

            <article v-for="item in group.items" :key="item.id" class="cart-row">
              <label class="cart-check inline">
                <input
                  type="checkbox"
                  :checked="isCartItemSelected(item.id)"
                  @change="toggleCartItemSelection(item.id)"
                />
              </label>

              <img
                v-if="item.productImagePath"
                :src="toImageUrl(item.productImagePath)"
                alt="Product"
                class="cart-image"
              />
              <div v-else class="cart-image placeholder">No Image</div>

              <div class="cart-content">
                <button type="button" class="product-link" @click="openProductFromCart(item)">
                  {{ withTrailingDots(item.productName, 34) }}
                </button>
                <p class="desc-line">{{ cartItemDescription(item) }}</p>
                <p class="stock-line">Stock Left: {{ item.stockQuantity }}</p>
              </div>

              <div class="cart-right">
                <div class="qty-controls">
                  <button
                    type="button"
                    class="qty-btn"
                    :disabled="isQuantityUpdating(item.id) || Number(item.quantity) <= 1"
                    @click="decreaseCartItemQuantity(item)"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    class="qty-input"
                    :value="item.quantity"
                    :max="item.stockQuantity"
                    :disabled="isQuantityUpdating(item.id)"
                    @change="onQuantityInputChange(item, $event)"
                  />
                  <button
                    type="button"
                    class="qty-btn"
                    :disabled="isQuantityUpdating(item.id) || Number(item.quantity) >= Number(item.stockQuantity)"
                    @click="increaseCartItemQuantity(item)"
                  >
                    +
                  </button>
                </div>
                <button type="button" class="mini-btn danger" @click="removeItemFromCart(item.id)">
                  Remove
                </button>
              </div>
            </article>
          </section>
        </div>

        <section class="summary-box">
          <h3 class="checkout-title">Selected Order Summary</h3>
          <p>Selected Items: {{ selectedCartItems.length }}</p>
          <p>Total Quantity: {{ selectedCartQuantity }}</p>

          <ul v-if="selectedCartItems.length" class="summary-list">
            <li v-for="item in selectedCartItems" :key="item.id">
              {{ item.productName }} | {{ item.size }} | Qty {{ item.quantity }} | {{ item.traderName }}
            </li>
          </ul>
          <p v-else class="muted">Select cart cards to checkout.</p>

          <button type="button" class="checkout-btn" @click="openCheckoutConfirmation">Checkout Selected</button>
        </section>
      </div>
    </section>

    <section v-if="activeTab === 'orders'" class="list-panel">
      <h2>My Orders ({{ orderCount }})</h2>
      <p v-if="loadingOrders" class="muted">Loading orders...</p>
      <p v-else-if="!orders.length" class="muted">No orders yet.</p>

      <div v-else class="orders-cards">
        <article v-for="order in orders" :key="order.id" class="order-card">
          <header class="order-head">
            <div>
              <h3>Order #{{ order.id }}</h3>
              <p>{{ formatOrderDate(order.createdAt) }}</p>
            </div>
            <span class="badge">{{ formatOrderStatus(order.status) }}</span>
          </header>

          <div class="order-meta">
            <p><strong>Full Name:</strong> {{ order.customerFullName || '-' }}</p>
            <p><strong>Contact:</strong> {{ order.customerContactNumber || '-' }}</p>
            <p><strong>Address:</strong> {{ order.deliveryFullAddress || '-' }}</p>
            <p><strong>Payment:</strong> {{ order.paymentMethod || 'cash_on_delivery' }}</p>
            <p><strong>Delivery Notes:</strong> {{ order.deliveryNotes || '-' }}</p>
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
                <p class="order-product">{{ withTrailingDots(item.productName, 36) }}</p>
                <p class="desc-line">Size: {{ item.size || 'N/A' }} | Length: {{ item.lengthCm ?? 'N/A' }} cm</p>
                <p class="stock-line">Trader: {{ item.traderName || 'Trader' }}</p>
              </div>

              <div class="cart-right">
                <p class="order-qty">Qty: {{ item.quantity }}</p>
              </div>
            </article>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="showCheckoutConfirmModal"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm checkout"
      @click.self="closeCheckoutConfirmation"
    >
      <section class="modal-card">
        <header class="modal-head">
          <h3>Confirm Your Checkout</h3>
          <button type="button" class="mini-btn" @click="closeCheckoutConfirmation">Close</button>
        </header>

        <p class="muted modal-subtext">
          Double check your selected items below. You can change quantity or unselect before confirming.
        </p>

        <div class="modal-item-list">
          <article v-for="item in selectedCartItems" :key="`confirm-${item.id}`" class="cart-row confirm-row">
            <label class="cart-check inline">
              <input
                type="checkbox"
                :checked="isCartItemSelected(item.id)"
                @change="toggleCartItemSelection(item.id)"
              />
            </label>

            <img
              v-if="item.productImagePath"
              :src="toImageUrl(item.productImagePath)"
              alt="Product"
              class="cart-image"
            />
            <div v-else class="cart-image placeholder">No Image</div>

            <div class="cart-content">
              <p class="order-product">{{ withTrailingDots(item.productName, 34) }}</p>
              <p class="desc-line">Size: {{ item.size || 'N/A' }} | Length: {{ item.lengthCm ?? 'N/A' }} cm</p>
              <p class="stock-line">Stock Left: {{ item.stockQuantity }} | Trader: {{ item.traderName }}</p>
            </div>

            <div class="cart-right">
              <div class="qty-controls">
                <button
                  type="button"
                  class="qty-btn"
                  :disabled="isQuantityUpdating(item.id) || Number(item.quantity) <= 1"
                  @click="decreaseCartItemQuantity(item)"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  class="qty-input"
                  :value="item.quantity"
                  :max="item.stockQuantity"
                  :disabled="isQuantityUpdating(item.id)"
                  @change="onQuantityInputChange(item, $event)"
                />
                <button
                  type="button"
                  class="qty-btn"
                  :disabled="isQuantityUpdating(item.id) || Number(item.quantity) >= Number(item.stockQuantity)"
                  @click="increaseCartItemQuantity(item)"
                >
                  +
                </button>
              </div>
            </div>
          </article>
        </div>

        <footer class="modal-actions">
          <p>Selected Items: {{ selectedCartItems.length }} | Total Quantity: {{ selectedCartQuantity }}</p>
          <button
            type="button"
            class="checkout-btn"
            :disabled="!selectedCartItems.length"
            @click="confirmCheckoutSelection"
          >
            Confirm Checkout (To Ship)
          </button>
        </footer>
      </section>
    </div>

    <div
      v-if="showProductEditModal && editingProduct"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Edit product"
      @click.self="closeEditProductModal"
    >
      <section class="modal-card product-edit-modal">
        <header class="modal-head">
          <h3>Edit Product</h3>
          <button type="button" class="mini-btn" @click="closeEditProductModal">Close</button>
        </header>

        <form class="form product-edit-form" @submit.prevent="saveEditedProduct">
          <label>
            Product Name
            <input v-model="editProductForm.productName" type="text" required />
          </label>

          <label>
            Size
            <select v-model="editProductForm.size" required>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>

          <label>
            Length (cm)
            <input v-model="editProductForm.lengthCm" type="number" step="0.01" min="0" />
          </label>

          <label>
            Stock Quantity
            <input v-model.number="editProductForm.stockQuantity" type="number" min="0" step="1" required />
          </label>

          <label>
            Update Product Image (optional)
            <input type="file" accept="image/*" @change="onSelectEditImage" />
          </label>

          <button type="submit" :disabled="productSaving">{{ productSaving ? 'Saving...' : 'Save Changes' }}</button>
        </form>
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

.product-card.clickable {
  cursor: pointer;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.cart-head-actions {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.address-preview {
  border: 1px solid rgba(126, 223, 192, 0.35);
  border-radius: 14px;
  background: rgba(4, 28, 39, 0.62);
  padding: 0.8rem;
}

.address-preview p {
  margin: 0.28rem 0 0;
}

.cart-cards {
  display: grid;
  gap: 0.7rem;
}

.cart-groups {
  display: grid;
  gap: 0.8rem;
}

.trader-group {
  border: 1px solid rgba(126, 223, 192, 0.32);
  border-radius: 14px;
  background: rgba(5, 26, 36, 0.72);
  padding: 0.65rem;
}

.trader-group-head {
  padding: 0.2rem 0.3rem 0.55rem;
}

.trader-group-head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: #dbfff3;
}

.cart-row {
  border-top: 1px solid rgba(126, 223, 192, 0.18);
  padding: 0.6rem 0.3rem;
  display: grid;
  grid-template-columns: 26px 68px 1fr auto;
  gap: 0.55rem;
  align-items: center;
}

.cart-row:first-of-type {
  border-top: 0;
}

.cart-card {
  border: 1px solid rgba(126, 223, 192, 0.32);
  border-radius: 14px;
  background: rgba(5, 26, 36, 0.72);
  padding: 0.75rem;
  display: grid;
  grid-template-columns: auto 84px 1fr auto;
  gap: 0.7rem;
  align-items: center;
}

.cart-check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.cart-check.inline {
  justify-content: center;
}

.cart-check input {
  width: 18px;
  height: 18px;
}

.cart-image {
  width: 68px;
  height: 68px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.cart-content p {
  margin: 0.18rem 0 0;
  color: #d2ffef;
}

.cart-content .desc-line {
  min-height: 1.2em;
}

.cart-content .stock-line {
  font-size: 0.78rem;
  color: #c0f9e2;
}

.cart-right {
  display: grid;
  gap: 0.3rem;
  justify-items: end;
}

.qty-controls {
  display: inline-grid;
  grid-template-columns: 26px 54px 26px;
  align-items: center;
  gap: 0.2rem;
}

.qty-btn {
  height: 26px;
  padding: 0;
  line-height: 1;
  border-radius: 8px;
  font-weight: 900;
  background: #1f67a8;
  border: 1px solid rgba(133, 229, 197, 0.55);
}

.qty-input {
  height: 26px;
  text-align: center;
  padding: 0.2rem;
  border-radius: 8px;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.qty-input[type='number'] {
  -moz-appearance: textfield;
}

.product-link {
  background: transparent;
  border: none;
  color: #8ce8ff;
  text-align: left;
  padding: 0;
  margin: 0;
  text-decoration: underline;
  font-size: 0.88rem;
  cursor: pointer;
}

.summary-box {
  border: 1px solid rgba(126, 223, 192, 0.35);
  border-radius: 14px;
  background: rgba(4, 28, 39, 0.62);
  padding: 0.8rem;
}

.summary-box p {
  margin: 0.28rem 0 0;
}

.summary-list {
  margin: 0.6rem 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.3rem;
  color: #d9fff0;
}

.orders-cards {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.8rem;
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

.order-head h3 {
  margin: 0;
  color: #dbfff3;
}

.order-head p {
  margin: 0.2rem 0 0;
  color: #c3f7e3;
  font-size: 0.8rem;
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
  grid-template-columns: 68px 1fr auto;
  gap: 0.55rem;
  align-items: center;
}

.order-product {
  margin: 0;
  color: #8ce8ff;
  font-weight: 700;
}

.order-qty {
  margin: 0;
  font-weight: 800;
  color: #e4fff4;
  font-size: 0.86rem;
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
  width: min(860px, 100%);
  border: 1px solid rgba(123, 225, 191, 0.4);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.96), rgba(9, 59, 71, 0.92));
  padding: 0.9rem;
  max-height: 88vh;
  overflow: auto;
}

.product-edit-modal {
  width: min(620px, 100%);
}

.product-edit-form {
  margin-top: 0.8rem;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
}

.modal-head h3 {
  margin: 0;
}

.modal-subtext {
  margin-top: 0.45rem;
}

.modal-item-list {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.55rem;
}

.confirm-row {
  border: 1px solid rgba(126, 223, 192, 0.2);
  border-radius: 10px;
  padding: 0.5rem;
}

.modal-actions {
  margin-top: 0.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.modal-actions p {
  margin: 0;
  color: #d7fff1;
  font-weight: 700;
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
  .cart-row {
    grid-template-columns: 22px 60px 1fr auto;
    gap: 0.45rem;
    align-items: center;
  }

  .cart-card {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .product-card {
    grid-template-columns: 1fr;
  }

  .cart-image {
    width: 60px;
    height: 60px;
  }

  .product-card img {
    width: 100%;
    height: 120px;
  }

  .order-item-row {
    grid-template-columns: 60px 1fr;
  }

  .modal-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
