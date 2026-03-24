const CHECKOUT_ADDRESS_KEY = 'cocolytics_checkout_address';

export function saveCheckoutAddress(address) {
  const payload = {
    fullName: String(address?.fullName || '').trim(),
    contactNumber: String(address?.contactNumber || '').trim(),
    streetAddress: String(address?.streetAddress || '').trim(),
    regionCode: String(address?.regionCode || '').trim(),
    regionName: String(address?.regionName || '').trim(),
    provinceCode: String(address?.provinceCode || '').trim(),
    provinceName: String(address?.provinceName || '').trim(),
    cityCode: String(address?.cityCode || '').trim(),
    cityName: String(address?.cityName || '').trim(),
    barangayCode: String(address?.barangayCode || '').trim(),
    barangayName: String(address?.barangayName || '').trim(),
    deliveryNotes: String(address?.deliveryNotes || '').trim(),
    paymentMethod: 'cash_on_delivery',
  };

  localStorage.setItem(CHECKOUT_ADDRESS_KEY, JSON.stringify(payload));
  return payload;
}

export function getCheckoutAddress() {
  const raw = localStorage.getItem(CHECKOUT_ADDRESS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCheckoutAddress() {
  localStorage.removeItem(CHECKOUT_ADDRESS_KEY);
}
