<script setup>
import { onMounted, reactive, ref } from 'vue';
import { fetchTraderProfile, updateTraderProfile } from '../../services/api';

const form = reactive({
  name: '',
  description: '',
  contactNumber: '',
  businessAddress: '',
});
const loading = ref(false);
const saving = ref(false);
const feedback = ref('');

async function loadProfile() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchTraderProfile();
    form.name = data.user.profileName || data.user.fullName || '';
    form.description = data.user.profileDescription || '';
    form.contactNumber = data.user.contactNumber || '';
    form.businessAddress = data.user.businessAddress || '';
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function submitProfile() {
  saving.value = true;
  feedback.value = '';
  try {
    const response = await updateTraderProfile({ ...form });
    feedback.value = response.message || 'Profile updated.';
  } catch (error) {
    feedback.value = error.message;
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Profile</p>
      <h1>Update Your Profile</h1>
      <p class="sub">Keep your business details updated for marketplace visibility.</p>
    </header>

    <form class="form" @submit.prevent="submitProfile">
      <label>
        Name
        <input v-model="form.name" type="text" placeholder="Your name or brand" required />
      </label>

      <label>
        Description
        <textarea
          v-model="form.description"
          rows="4"
          placeholder="Describe your trading business"
        ></textarea>
      </label>

      <label>
        Contact Number
        <input v-model="form.contactNumber" type="text" placeholder="09xx..." required />
      </label>

      <label>
        Business Address
        <input v-model="form.businessAddress" type="text" placeholder="Business location" required />
      </label>

      <button type="submit" :disabled="saving || loading">{{ saving ? 'Saving...' : 'Save Profile' }}</button>
    </form>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.page {
  color: #effff7;
}

.head h1 {
  margin: 0.45rem 0 0;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #9cf5cd;
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
  gap: 0.8rem;
}

label {
  display: grid;
  gap: 0.32rem;
  font-weight: 700;
  color: #d5fff0;
}

input,
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
</style>
