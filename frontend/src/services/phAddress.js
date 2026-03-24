let cache = null;

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error('Could not load Philippine address data.');
  }

  return response.json();
}

export async function loadPhAddressData() {
  if (cache) {
    return cache;
  }

  const [regions, provinces, cities, barangays] = await Promise.all([
    fetchJson('/ph-json/region.json'),
    fetchJson('/ph-json/province.json'),
    fetchJson('/ph-json/city.json'),
    fetchJson('/ph-json/barangay.json'),
  ]);

  cache = {
    regions: Array.isArray(regions) ? regions : [],
    provinces: Array.isArray(provinces) ? provinces : [],
    cities: Array.isArray(cities) ? cities : [],
    barangays: Array.isArray(barangays) ? barangays : [],
  };

  return cache;
}

export function normalizeByName(list, key) {
  return [...list].sort((a, b) =>
    String(a?.[key] || '').localeCompare(String(b?.[key] || ''), undefined, { sensitivity: 'base' })
  );
}
