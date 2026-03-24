<script setup>
import { onMounted, reactive, ref } from 'vue';
import {
  fetchTraderProfile,
  updateTraderProfile,
  uploadTraderProfileImage,
} from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getToken, saveSession } from '../../services/session';

const form = reactive({
  name: '',
  description: '',
  contactNumber: '',
  businessAddress: '',
});
const loading = ref(false);
const saving = ref(false);
const feedback = ref('');
const profileImageFile = ref(null);
const profileImagePreview = ref('');

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

async function loadProfile() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchTraderProfile();
    form.name = data.user.profileName || data.user.fullName || '';
    form.description = data.user.profileDescription || '';
    form.contactNumber = data.user.contactNumber || '';
    form.businessAddress = data.user.businessAddress || '';
    profileImagePreview.value = toImageUrl(data.user.profileImagePath || '');
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

function onSelectProfileImage(event) {
  const [file] = event.target.files || [];
  profileImageFile.value = file || null;

  if (file) {
    profileImagePreview.value = URL.createObjectURL(file);
  }
}

async function submitProfile() {
  saving.value = true;
  feedback.value = '';
  try {
    const profileResponse = await updateTraderProfile({ ...form });
    let latestUser = profileResponse.user;

    if (profileImageFile.value) {
      const imageResponse = await uploadTraderProfileImage(profileImageFile.value);
      latestUser = imageResponse.user || latestUser;
      profileImageFile.value = null;
      profileImagePreview.value = toImageUrl(latestUser?.profileImagePath || '');
    }

    if (latestUser) {
      saveSession(getToken(), latestUser);
    }

    feedback.value = 'Profile updated successfully.';
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

    <section class="avatar-card">
      <img v-if="profileImagePreview" :src="profileImagePreview" alt="Profile" class="avatar" />
      <div v-else class="avatar placeholder">No Photo</div>
      <label class="file-label">
        Upload Profile Picture
        <input type="file" accept="image/*" @change="onSelectProfileImage" />
      </label>
    </section>

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

.avatar-card {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 1rem;
  display: grid;
  gap: 0.7rem;
  justify-items: center;
}

.avatar {
  width: 110px;
  height: 110px;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(135, 230, 199, 0.48);
}

.avatar.placeholder {
  display: grid;
  place-items: center;
  background: rgba(6, 29, 40, 0.7);
  color: #c9ffe9;
  font-weight: 800;
}

.file-label {
  width: 100%;
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
