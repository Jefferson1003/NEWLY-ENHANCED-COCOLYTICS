import { getToken } from './session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

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
