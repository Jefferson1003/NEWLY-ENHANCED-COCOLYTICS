const TOKEN_KEY = 'cocolytics_token';
const USER_KEY = 'cocolytics_user';
const VISIT_TRADER_INTENT_KEY = 'cocolytics_visit_trader_intent';
export const SESSION_UPDATED_EVENT = 'cocolytics-session-updated';

function emitSessionUpdate() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitSessionUpdate();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(VISIT_TRADER_INTENT_KEY);
  emitSessionUpdate();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function setVisitTraderIntent(traderId) {
  const normalizedId = Number(traderId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return;
  }

  localStorage.setItem(VISIT_TRADER_INTENT_KEY, String(normalizedId));
}

export function getVisitTraderIntent() {
  const raw = localStorage.getItem(VISIT_TRADER_INTENT_KEY);
  const traderId = Number(raw);
  return Number.isInteger(traderId) && traderId > 0 ? traderId : null;
}

export function clearVisitTraderIntent() {
  localStorage.removeItem(VISIT_TRADER_INTENT_KEY);
}
