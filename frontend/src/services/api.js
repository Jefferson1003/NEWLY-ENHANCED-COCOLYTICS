import { getToken } from './session';
import { toastError, toastSuccess } from './toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function resolveDefaultSuccessMessage(method) {
  if (method === 'POST') return 'Created successfully.';
  if (method === 'PATCH' || method === 'PUT') return 'Updated successfully.';
  if (method === 'DELETE') return 'Deleted successfully.';
  return 'Request completed successfully.';
}

async function request(path, options = {}, meta = {}) {
  const token = getToken();
  const method = String(options.method || 'GET').toUpperCase();
  const shouldToastError = meta.toastError !== false;
  const shouldToastSuccess = meta.toastSuccess ?? (method !== 'GET');
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
    const errorMessage = data.error || 'Request failed';
    if (shouldToastError) {
      toastError(errorMessage);
    }
    const requestError = new Error(errorMessage);
    requestError.code = data.code || '';
    requestError.details = data;
    throw requestError;
  }

  if (shouldToastSuccess) {
    const successMessage = String(meta.successMessage || data.message || resolveDefaultSuccessMessage(method)).trim();
    if (successMessage) {
      toastSuccess(successMessage);
    }
  }

  return data;
}

export function register(payload) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'Registration submitted successfully.',
  });
}

export function login(payload) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'Login successful.',
  });
}

export function resendVerifyEmailOtp(payload) {
  return request('/api/auth/verify-email/resend', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'Verification OTP sent.',
  });
}

export function verifyEmailOtp(payload) {
  return request('/api/auth/verify-email/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'Email verified successfully.',
  });
}

export function requestForgotPasswordOtp(payload) {
  return request('/api/auth/forgot-password/request-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'OTP sent if your email exists.',
  });
}

export function verifyForgotPasswordOtp(payload) {
  return request('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'OTP verified. Set your new password.',
  });
}

export function resetForgotPassword(payload) {
  return request('/api/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'Password reset successful.',
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
  }, {
    successMessage: 'Client accepted successfully.',
  });
}

export function acceptStaff(id) {
  return request(`/api/admin/clients/${id}/accept-staff`, {
    method: 'PATCH',
  }, {
    successMessage: 'Staff application accepted successfully.',
  });
}

export function acceptTraderRole() {
  return request('/api/client/accept-trader', {
    method: 'POST',
  }, {
    successMessage: 'Trader application submitted successfully.',
  });
}

export function fetchTraderProfile() {
  return request('/api/trader/profile');
}

export function updateTraderProfile(payload) {
  return request('/api/trader/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, {
    successMessage: 'Profile updated successfully.',
  });
}

export function uploadTraderProfileImage(file) {
  const formData = new FormData();
  formData.append('profileImage', file);

  return request('/api/trader/profile/image', {
    method: 'POST',
    body: formData,
  }, {
    successMessage: 'Profile image uploaded successfully.',
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
  }, {
    successMessage: 'Product added successfully.',
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
  }, {
    successMessage: 'Product updated successfully.',
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
  }, {
    successMessage: 'Item added to cart.',
  });
}

export function removeCartItem(id) {
  return request(`/api/trader/cart/${id}`, {
    method: 'DELETE',
  }, {
    successMessage: 'Item removed from cart.',
  });
}

export function updateCartItemQuantity(id, quantity) {
  return request(`/api/trader/cart/${id}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  }, {
    successMessage: 'Cart quantity updated.',
  });
}

export function placeMyOrder(payload) {
  return request('/api/trader/orders/place', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }, {
    successMessage: 'Order placed successfully.',
  });
}

export function fetchMyOrders() {
  return request('/api/trader/orders');
}

export function cancelMyOrder(orderId, cancellationReason) {
  return request(`/api/trader/orders/${orderId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ cancellationReason }),
  }, {
    successMessage: 'Order cancelled successfully.',
  });
}

export function markMyOrderReceived(orderId) {
  return request(`/api/trader/orders/${orderId}/received`, {
    method: 'PATCH',
  }, {
    successMessage: 'Order marked as received.',
  });
}

export function fetchTraderSalesOrders() {
  return request('/api/trader/orders/sales');
}

export function updateTraderSalesOrderStatus(orderId, status) {
  return request(`/api/trader/orders/sales/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, {
    successMessage: status === 'to_ship'
      ? 'Order accepted and marked as To Ship.'
      : status === 'to_receive'
        ? 'Order marked as To Receive.'
        : 'Order status updated successfully.',
  });
}

export function fetchTraderMessageContacts() {
  return request('/api/trader/messages/contacts');
}

export function fetchMessagesWithTrader(traderId) {
  return request(`/api/trader/messages/${traderId}`);
}

export function sendMessageToTrader(traderId, messageText, options = {}) {
  const replyToMessageId = Number(options.replyToMessageId);
  const safeReplyToMessageId = Number.isInteger(replyToMessageId) && replyToMessageId > 0
    ? replyToMessageId
    : null;

  if (options.messageImageFile) {
    const formData = new FormData();
    formData.append('messageText', String(messageText || ''));
    if (safeReplyToMessageId) {
      formData.append('replyToMessageId', String(safeReplyToMessageId));
    }
    formData.append('messageImage', options.messageImageFile);

    return request(`/api/trader/messages/${traderId}`, {
      method: 'POST',
      body: formData,
    }, {
      successMessage: 'Message sent.',
    });
  }

  return request(`/api/trader/messages/${traderId}`, {
    method: 'POST',
    body: JSON.stringify({
      messageText,
      replyToMessageId: safeReplyToMessageId,
    }),
  }, {
    successMessage: 'Message sent.',
  });
}

export function heartbeatTraderMessagePresence() {
  return request('/api/trader/messages/presence/heartbeat', {
    method: 'POST',
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function sendTraderCallSignal(traderId, signalType, payload = {}) {
  return request(`/api/trader/messages/${traderId}/call-signal`, {
    method: 'POST',
    body: JSON.stringify({ signalType, payload }),
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function getTraderMessageStreamUrl() {
  const token = getToken();
  const streamPath = '/api/trader/messages/stream';
  if (!token) {
    return `${API_BASE_URL}${streamPath}`;
  }

  const separator = streamPath.includes('?') ? '&' : '?';
  return `${API_BASE_URL}${streamPath}${separator}token=${encodeURIComponent(token)}`;
}

export function fetchTraderPaperUploads() {
  return request('/api/trader/paper-uploads');
}

export function uploadTraderPaper(payload) {
  const formData = new FormData();
  formData.append('paperType', payload.paperType || '');
  formData.append('title', payload.title || '');
  formData.append('description', payload.description || '');

  if (payload.paperFile) {
    formData.append('paperFile', payload.paperFile);
  }

  return request('/api/trader/paper-uploads', {
    method: 'POST',
    body: formData,
  }, {
    successMessage: 'Paper uploaded successfully.',
  });
}

export function fetchAdminPaperUploads() {
  return request('/api/admin/paper-uploads');
}

export function reviewAdminPaperUpload(uploadId, payload) {
  return request(`/api/admin/paper-uploads/${uploadId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: payload.status,
      reviewNotes: payload.reviewNotes || '',
    }),
  }, {
    successMessage: 'Paper review updated successfully.',
  });
}
