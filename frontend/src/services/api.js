import { clearSession, getToken } from './session';
import { toastError, toastSuccess } from './toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const FORCED_LOGOUT_MESSAGE_KEY = 'cocolytics_forced_logout_message';

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
    const isArchivedError = data.code === 'ACCOUNT_ARCHIVED';

    if (isArchivedError) {
      const forcedMessage = 'You have been forced logout because your account was archived by the administrator.';
      clearSession();

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(FORCED_LOGOUT_MESSAGE_KEY, forcedMessage);
        if (window.location.pathname !== '/auth') {
          window.location.assign('/auth');
        } else {
          toastError(forcedMessage, 'Forced Logout', 5000);
        }
      }
    }

    if (shouldToastError && !isArchivedError) {
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

export function acceptAllStaffApplications() {
  return request('/api/admin/clients/accept-staff-all', {
    method: 'PATCH',
  }, {
    successMessage: 'All pending staff applications accepted successfully.',
  });
}

export function fetchClientDetails(id) {
  return request(`/api/admin/clients/${id}/details`);
}

export function archiveClient(id) {
  return request(`/api/admin/clients/${id}/archive`, {
    method: 'PATCH',
  }, {
    successMessage: 'User archived successfully.',
  });
}

export function restoreClient(id) {
  return request(`/api/admin/clients/${id}/restore`, {
    method: 'PATCH',
  }, {
    successMessage: 'User restored successfully.',
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

export function uploadTraderGcashQr(file) {
  const formData = new FormData();
  formData.append('gcashQrImage', file);

  return request('/api/trader/profile/gcash-qr', {
    method: 'POST',
    body: formData,
  }, {
    successMessage: 'GCash QR uploaded successfully.',
  });
}

export function removeTraderGcashQr() {
  return request('/api/trader/profile/gcash-qr', {
    method: 'DELETE',
  }, {
    successMessage: 'GCash QR removed successfully.',
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
  formData.append('productPrice', String(payload.productPrice ?? ''));
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
  formData.append('productPrice', String(payload.productPrice ?? ''));
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

export function removeTraderProduct(productId) {
  return request(`/api/trader/products/${productId}`, {
    method: 'DELETE',
  }, {
    successMessage: 'Product deleted successfully.',
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
  const formData = new FormData();
  formData.append('fullName', String(payload?.fullName || ''));
  formData.append('contactNumber', String(payload?.contactNumber || ''));
  formData.append('streetAddress', String(payload?.streetAddress || ''));
  formData.append('regionName', String(payload?.regionName || ''));
  formData.append('provinceName', String(payload?.provinceName || ''));
  formData.append('cityName', String(payload?.cityName || ''));
  formData.append('barangayName', String(payload?.barangayName || ''));
  formData.append('paymentMethod', String(payload?.paymentMethod || 'cash_on_delivery'));
  formData.append('deliveryNotes', String(payload?.deliveryNotes || ''));
  formData.append('selectedCartItemIds', JSON.stringify(Array.isArray(payload?.selectedCartItemIds) ? payload.selectedCartItemIds : []));

  if (payload?.paymentReceiptImage) {
    formData.append('paymentReceiptImage', payload.paymentReceiptImage);
  }

  return request('/api/trader/orders/place', {
    method: 'POST',
    body: formData,
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

export function markMyOrderReceived(orderId, payload = {}) {
  return request(`/api/trader/orders/${orderId}/received`, {
    method: 'PATCH',
    body: JSON.stringify(payload || {}),
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
      ? 'Order dispatched and marked as To Ship.'
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

export function sendTraderTypingStatus(traderId, isTyping) {
  return request(`/api/trader/messages/${traderId}/typing`, {
    method: 'POST',
    body: JSON.stringify({ isTyping: Boolean(isTyping) }),
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function fetchClientMessageContacts() {
  return request('/api/client/messages/contacts');
}

export function fetchMessagesWithAdmin(adminId) {
  return request(`/api/client/messages/${adminId}`);
}

export function sendMessageToAdmin(adminId, messageText, options = {}) {
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

    return request(`/api/client/messages/${adminId}`, {
      method: 'POST',
      body: formData,
    }, {
      successMessage: 'Message sent.',
    });
  }

  return request(`/api/client/messages/${adminId}`, {
    method: 'POST',
    body: JSON.stringify({
      messageText,
      replyToMessageId: safeReplyToMessageId,
    }),
  }, {
    successMessage: 'Message sent.',
  });
}

export function heartbeatClientMessagePresence() {
  return request('/api/client/messages/presence/heartbeat', {
    method: 'POST',
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function sendClientCallSignal(adminId, signalType, payload = {}) {
  return request(`/api/client/messages/${adminId}/call-signal`, {
    method: 'POST',
    body: JSON.stringify({ signalType, payload }),
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function sendClientTypingStatus(adminId, isTyping) {
  return request(`/api/client/messages/${adminId}/typing`, {
    method: 'POST',
    body: JSON.stringify({ isTyping: Boolean(isTyping) }),
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function fetchAdminMessageContacts() {
  return request('/api/admin/messages/contacts');
}

export function fetchMessagesWithUser(userId) {
  return request(`/api/admin/messages/${userId}`);
}

export function sendMessageToUser(userId, messageText, options = {}) {
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

    return request(`/api/admin/messages/${userId}`, {
      method: 'POST',
      body: formData,
    }, {
      successMessage: 'Message sent.',
    });
  }

  return request(`/api/admin/messages/${userId}`, {
    method: 'POST',
    body: JSON.stringify({
      messageText,
      replyToMessageId: safeReplyToMessageId,
    }),
  }, {
    successMessage: 'Message sent.',
  });
}

export function heartbeatAdminMessagePresence() {
  return request('/api/admin/messages/presence/heartbeat', {
    method: 'POST',
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function sendAdminCallSignal(userId, signalType, payload = {}) {
  return request(`/api/admin/messages/${userId}/call-signal`, {
    method: 'POST',
    body: JSON.stringify({ signalType, payload }),
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function sendAdminTypingStatus(userId, isTyping) {
  return request(`/api/admin/messages/${userId}/typing`, {
    method: 'POST',
    body: JSON.stringify({ isTyping: Boolean(isTyping) }),
  }, {
    toastError: false,
    toastSuccess: false,
  });
}

export function getTraderMessageStreamUrl() {
  return getRoleMessageStreamUrl('/api/trader/messages/stream');
}

export function getClientMessageStreamUrl() {
  return getRoleMessageStreamUrl('/api/client/messages/stream');
}

export function getAdminMessageStreamUrl() {
  return getRoleMessageStreamUrl('/api/admin/messages/stream');
}

function getRoleMessageStreamUrl(streamPath) {
  const token = getToken();
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
