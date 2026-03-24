function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.replace(/\/$/, '');
}

function withHttpsIfNeeded(url) {
  if (typeof window === 'undefined') return url;
  if (window.location.protocol !== 'https:') return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString().replace(/\/$/, '');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

function resolveFileBaseUrl() {
  const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  const apiBaseUrl = normalizeBaseUrl(rawApiBaseUrl);
  const derived = apiBaseUrl ? apiBaseUrl.replace(/\/api\/?$/, '') : window.location.origin;
  return withHttpsIfNeeded(normalizeBaseUrl(derived));
}

export function toMediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) {
    return withHttpsIfNeeded(path);
  }

  const base = resolveFileBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
