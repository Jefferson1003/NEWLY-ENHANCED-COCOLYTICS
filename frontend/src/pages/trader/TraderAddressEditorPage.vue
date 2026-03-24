<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { fetchTraderProfile } from '../../services/api';
import { loadPhAddressData, normalizeByName } from '../../services/phAddress';
import { getCheckoutAddress, saveCheckoutAddress } from '../../services/checkoutAddress';
import { getUser } from '../../services/session';

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const feedback = ref('');
const regions = ref([]);
const provinces = ref([]);
const cities = ref([]);
const barangays = ref([]);

const form = reactive({
  fullName: '',
  contactNumber: '',
  streetAddress: '',
  regionCode: '',
  provinceCode: '',
  cityCode: '',
  barangayCode: '',
  deliveryNotes: '',
});

const filteredProvinces = computed(() => {
  if (!form.regionCode) return [];
  return normalizeByName(
    provinces.value.filter((province) => String(province.region_code) === String(form.regionCode)),
    'province_name'
  );
});

const filteredCities = computed(() => {
  if (!form.provinceCode) return [];
  return normalizeByName(
    cities.value.filter((city) => String(city.province_code) === String(form.provinceCode)),
    'city_name'
  );
});

const filteredBarangays = computed(() => {
  if (!form.cityCode) return [];
  return normalizeByName(
    barangays.value.filter((barangay) => String(barangay.city_code) === String(form.cityCode)),
    'brgy_name'
  );
});

function selectedRegion() {
  return regions.value.find((region) => String(region.region_code) === String(form.regionCode)) || null;
}

function selectedProvince() {
  return provinces.value.find((province) => String(province.province_code) === String(form.provinceCode)) || null;
}

function selectedCity() {
  return cities.value.find((city) => String(city.city_code) === String(form.cityCode)) || null;
}

function selectedBarangay() {
  return barangays.value.find((barangay) => String(barangay.brgy_code) === String(form.barangayCode)) || null;
}

function onRegionChange() {
  form.provinceCode = '';
  form.cityCode = '';
  form.barangayCode = '';
}

function onProvinceChange() {
  form.cityCode = '';
  form.barangayCode = '';
}

function onCityChange() {
  form.barangayCode = '';
}

async function loadAddressData() {
  loading.value = true;
  feedback.value = '';

  try {
    const data = await loadPhAddressData();
    regions.value = normalizeByName(data.regions || [], 'region_name');
    provinces.value = data.provinces || [];
    cities.value = data.cities || [];
    barangays.value = data.barangays || [];

    const savedAddress = getCheckoutAddress();
    const user = getUser() || {};
    let profileUser = null;

    try {
      const profileData = await fetchTraderProfile();
      profileUser = profileData?.user || null;
    } catch {
      profileUser = null;
    }

    const profileFullName = String(
      profileUser?.profileName || profileUser?.fullName || user.fullName || user.profileName || ''
    ).trim();
    const profileContactNumber = String(profileUser?.contactNumber || user.contactNumber || '').trim();

    form.fullName = String(savedAddress?.fullName || profileFullName).trim();
    form.contactNumber = profileContactNumber || String(savedAddress?.contactNumber || '').trim();
    form.streetAddress = String(savedAddress?.streetAddress || '').trim();
    form.regionCode = String(savedAddress?.regionCode || '').trim();
    form.provinceCode = String(savedAddress?.provinceCode || '').trim();
    form.cityCode = String(savedAddress?.cityCode || '').trim();
    form.barangayCode = String(savedAddress?.barangayCode || '').trim();
    form.deliveryNotes = String(savedAddress?.deliveryNotes || '').trim();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push({ name: 'trader-marketplace', query: { tab: 'cart' } });
}

function submitAddress() {
  const region = selectedRegion();
  const province = selectedProvince();
  const city = selectedCity();
  const barangay = selectedBarangay();

  if (
    !form.fullName.trim() ||
    !form.contactNumber.trim() ||
    !form.streetAddress.trim() ||
    !region ||
    !province ||
    !city ||
    !barangay
  ) {
    feedback.value = 'Please complete full name, contact number, and complete address.';
    return;
  }

  saving.value = true;

  try {
    saveCheckoutAddress({
      fullName: form.fullName,
      contactNumber: form.contactNumber,
      streetAddress: form.streetAddress,
      regionCode: form.regionCode,
      regionName: region.region_name,
      provinceCode: form.provinceCode,
      provinceName: province.province_name,
      cityCode: form.cityCode,
      cityName: city.city_name,
      barangayCode: form.barangayCode,
      barangayName: barangay.brgy_name,
      deliveryNotes: form.deliveryNotes,
    });

    router.push({ name: 'trader-marketplace', query: { tab: 'cart', addressSaved: '1' } });
  } finally {
    saving.value = false;
  }
}

onMounted(loadAddressData);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Checkout</p>
      <h1>Address Editor</h1>
      <p class="sub">Save your delivery details for selected cart checkout.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>
    <p v-if="loading" class="muted">Loading address data...</p>

    <form v-else class="form" @submit.prevent="submitAddress">
      <label>
        Full Name
        <input v-model="form.fullName" type="text" placeholder="Receiver full name" required />
      </label>

      <label>
        Contact Number
        <input v-model="form.contactNumber" type="text" placeholder="09xxxxxxxxx" required />
      </label>

      <label>
        Region
        <select v-model="form.regionCode" required @change="onRegionChange">
          <option disabled value="">Select region</option>
          <option v-for="region in regions" :key="region.region_code" :value="region.region_code">
            {{ region.region_name }}
          </option>
        </select>
      </label>

      <label>
        Province
        <select v-model="form.provinceCode" required @change="onProvinceChange">
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
        <select v-model="form.cityCode" required @change="onCityChange">
          <option disabled value="">Select city/municipality</option>
          <option v-for="city in filteredCities" :key="city.city_code" :value="city.city_code">
            {{ city.city_name }}
          </option>
        </select>
      </label>

      <label>
        Barangay
        <select v-model="form.barangayCode" required>
          <option disabled value="">Select barangay</option>
          <option v-for="barangay in filteredBarangays" :key="barangay.brgy_code" :value="barangay.brgy_code">
            {{ barangay.brgy_name }}
          </option>
        </select>
      </label>

      <label class="full-width">
        Street / Unit / Landmark
        <input v-model="form.streetAddress" type="text" placeholder="House No., street, landmark" required />
      </label>

      <label class="full-width">
        Delivery Notes
        <textarea
          v-model="form.deliveryNotes"
          rows="3"
          placeholder="Optional: nearest landmark, gate color, preferred call/text"
        ></textarea>
      </label>

      <div class="actions">
        <button type="button" class="secondary" @click="goBack">Back to Cart</button>
        <button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save Address' }}</button>
      </div>
    </form>
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

.form {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
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

.full-width {
  grid-column: 1 / -1;
}

.actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
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

button.secondary {
  background: #275f9f;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffc4d2;
}

.muted {
  color: #c2f7e0;
  margin-top: 0.65rem;
}

@media (max-width: 640px) {
  .form {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-direction: column;
  }
}
</style>
