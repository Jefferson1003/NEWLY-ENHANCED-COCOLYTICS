import { getToken } from './session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const token = getToken();
  const isFormDataBody = options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
  };

  if (!isFormDataBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function register(payload) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMe() {
  return request('/api/auth/me');
}

export function fetchClients() {
  return request('/api/admin/clients');
}

export function acceptClient(id) {
  return request(`/api/admin/clients/${id}/accept-client`, {
    method: 'PATCH',
  });
}

export function acceptStaff(id) {
  return request(`/api/admin/clients/${id}/accept-staff`, {
    method: 'PATCH',
  });
}

export function acceptTraderRole() {
  return request('/api/client/accept-trader', {
    method: 'POST',
  });
}

export function fetchTraderProfile() {
  return request('/api/trader/profile');
}

export function updateTraderProfile(payload) {
  return request('/api/trader/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function uploadTraderProfileImage(file) {
  const formData = new FormData();
  formData.append('profileImage', file);

  return request('/api/trader/profile/image', {
    method: 'POST',
    body: formData,
  });
}

export function fetchTraderProducts() {
  return request('/api/trader/products');
}

export function createTraderProduct(payload) {
  const formData = new FormData();
  formData.append('productName', payload.productName || '');
  formData.append('size', payload.size || '');
  formData.append('lengthCm', payload.lengthCm ?? '');
  formData.append('stockQuantity', String(payload.stockQuantity ?? ''));

  if (payload.productImage) {
    formData.append('productImage', payload.productImage);
  }

  return request('/api/trader/products', {
    method: 'POST',
    body: formData,
  });
}

export function updateTraderProduct(productId, payload) {
  const formData = new FormData();
  formData.append('productName', payload.productName || '');
  formData.append('size', payload.size || '');
  formData.append('lengthCm', payload.lengthCm ?? '');
  formData.append('stockQuantity', String(payload.stockQuantity ?? ''));

  if (payload.productImage) {
    formData.append('productImage', payload.productImage);
  }

  return request(`/api/trader/products/${productId}`, {
    method: 'PATCH',
    body: formData,
  });
}

export function fetchMarketplaceTraders() {
  return request('/api/trader/marketplace/traders');
}

export function fetchPublicMarketplaceTraders() {
  return request('/api/trader/public/marketplace/traders');
}

export function fetchPublicMarketplaceTraderDetail(traderId) {
  return request(`/api/trader/public/marketplace/traders/${traderId}`);
}

export function fetchCartItems() {
  return request('/api/trader/cart');
}

export function addCartItem(payload) {
  return request('/api/trader/cart', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeCartItem(id) {
  return request(`/api/trader/cart/${id}`, {
    method: 'DELETE',
  });
}

export function updateCartItemQuantity(id, quantity) {
  return request(`/api/trader/cart/${id}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function placeMyOrder(payload) {
  return request('/api/trader/orders/place', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export function fetchMyOrders() {
  return request('/api/trader/orders');
}
