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
const showImageCropModal = ref(false);
const showImageViewerModal = ref(false);
const cropImageUrl = ref('');
const cropImageNaturalWidth = ref(0);
const cropImageNaturalHeight = ref(0);
const cropScale = ref(1);
const cropOffsetX = ref(0);
const cropOffsetY = ref(0);

const CROP_VIEWPORT_SIZE = 280;

let cropDragPointerId = null;
let cropDragStartX = 0;
let cropDragStartY = 0;
let cropDragOriginX = 0;
let cropDragOriginY = 0;

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function cropBaseScale() {
  const width = Number(cropImageNaturalWidth.value || 0);
  const height = Number(cropImageNaturalHeight.value || 0);
  if (width <= 0 || height <= 0) return 1;
  return Math.max(CROP_VIEWPORT_SIZE / width, CROP_VIEWPORT_SIZE / height);
}

function cropRenderedWidth() {
  return Math.max(1, cropImageNaturalWidth.value * cropBaseScale() * cropScale.value);
}

function cropRenderedHeight() {
  return Math.max(1, cropImageNaturalHeight.value * cropBaseScale() * cropScale.value);
}

function clampCropOffsets() {
  const maxOffsetX = Math.max(0, (cropRenderedWidth() - CROP_VIEWPORT_SIZE) / 2);
  const maxOffsetY = Math.max(0, (cropRenderedHeight() - CROP_VIEWPORT_SIZE) / 2);
  cropOffsetX.value = Math.min(maxOffsetX, Math.max(-maxOffsetX, cropOffsetX.value));
  cropOffsetY.value = Math.min(maxOffsetY, Math.max(-maxOffsetY, cropOffsetY.value));
}

function recenterCropImage() {
  cropOffsetX.value = 0;
  cropOffsetY.value = 0;
}

function updateCropScale(value) {
  cropScale.value = Number(value || 1);
  clampCropOffsets();
}

function cropImageStyle() {
  const width = cropImageNaturalWidth.value * cropBaseScale();
  const height = cropImageNaturalHeight.value * cropBaseScale();
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(calc(-50% + ${cropOffsetX.value}px), calc(-50% + ${cropOffsetY.value}px)) scale(${cropScale.value})`,
  };
}

function stopCropDrag() {
  cropDragPointerId = null;
}

function onCropPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  cropDragPointerId = event.pointerId;
  cropDragStartX = Number(event.clientX || 0);
  cropDragStartY = Number(event.clientY || 0);
  cropDragOriginX = cropOffsetX.value;
  cropDragOriginY = cropOffsetY.value;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
}

function onCropPointerMove(event) {
  if (cropDragPointerId !== event.pointerId) {
    return;
  }

  const deltaX = Number(event.clientX || 0) - cropDragStartX;
  const deltaY = Number(event.clientY || 0) - cropDragStartY;
  cropOffsetX.value = cropDragOriginX + deltaX;
  cropOffsetY.value = cropDragOriginY + deltaY;
  clampCropOffsets();
}

function clearCropModal() {
  if (cropImageUrl.value) {
    URL.revokeObjectURL(cropImageUrl.value);
  }
  cropImageUrl.value = '';
  cropImageNaturalWidth.value = 0;
  cropImageNaturalHeight.value = 0;
  cropScale.value = 1;
  cropOffsetX.value = 0;
  cropOffsetY.value = 0;
  showImageCropModal.value = false;
}

function closeCropModal() {
  showImageCropModal.value = false;
}

function openImageViewer() {
  if (!profileImagePreview.value) {
    return;
  }

  showImageViewerModal.value = true;
}

function closeImageViewer() {
  showImageViewerModal.value = false;
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
  if (!file) {
    return;
  }

  if (profileImagePreview.value && profileImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(profileImagePreview.value);
  }

  if (cropImageUrl.value && cropImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(cropImageUrl.value);
  }

  const fileUrl = URL.createObjectURL(file);
  profileImageFile.value = file;
  profileImagePreview.value = fileUrl;

  const image = new Image();
  image.onload = () => {
    cropImageNaturalWidth.value = Number(image.naturalWidth || 0);
    cropImageNaturalHeight.value = Number(image.naturalHeight || 0);
    cropImageUrl.value = fileUrl;
    cropScale.value = 1;
    recenterCropImage();
    showImageCropModal.value = true;
    feedback.value = '';
  };
  image.onerror = () => {
    URL.revokeObjectURL(fileUrl);
    feedback.value = 'Could not read selected image.';
  };
  image.src = fileUrl;

  event.target.value = '';
}

async function applyCroppedImage() {
  if (!cropImageUrl.value || !cropImageNaturalWidth.value || !cropImageNaturalHeight.value) {
    return;
  }

  const image = new Image();
  image.src = cropImageUrl.value;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const renderedWidth = cropRenderedWidth();
  const renderedHeight = cropRenderedHeight();
  const displayLeft = (CROP_VIEWPORT_SIZE / 2) + cropOffsetX.value - (renderedWidth / 2);
  const displayTop = (CROP_VIEWPORT_SIZE / 2) + cropOffsetY.value - (renderedHeight / 2);

  const sx = Math.max(0, (0 - displayLeft) * (cropImageNaturalWidth.value / renderedWidth));
  const sy = Math.max(0, (0 - displayTop) * (cropImageNaturalHeight.value / renderedHeight));
  const sWidth = Math.min(cropImageNaturalWidth.value - sx, CROP_VIEWPORT_SIZE * (cropImageNaturalWidth.value / renderedWidth));
  const sHeight = Math.min(cropImageNaturalHeight.value - sy, CROP_VIEWPORT_SIZE * (cropImageNaturalHeight.value / renderedHeight));

  const canvas = document.createElement('canvas');
  const outputSize = 720;
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  context.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, outputSize, outputSize);

  const blob = await new Promise((resolve) => {
    canvas.toBlob((nextBlob) => {
      resolve(nextBlob);
    }, 'image/jpeg', 0.92);
  });

  if (!blob) {
    feedback.value = 'Could not crop image.';
    return;
  }

  const croppedFile = new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' });
  profileImageFile.value = croppedFile;

  if (profileImagePreview.value && profileImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(profileImagePreview.value);
  }
  profileImagePreview.value = URL.createObjectURL(croppedFile);
  showImageCropModal.value = false;
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
      <img
        v-if="profileImagePreview"
        :src="profileImagePreview"
        alt="Profile"
        class="avatar clickable"
        @click="openImageViewer"
      />
      <div v-else class="avatar placeholder">No Photo</div>
      <label class="file-label">
        Upload Profile Picture
        <input type="file" accept="image/*" @change="onSelectProfileImage" />
      </label>
    </section>

    <div v-if="showImageViewerModal" class="viewer-modal" @click.self="closeImageViewer">
      <div class="viewer-card" role="dialog" aria-modal="true" aria-label="Profile image preview">
        <img :src="profileImagePreview" alt="Profile preview" class="viewer-image" />
        <button type="button" @click="closeImageViewer">Close</button>
      </div>
    </div>

    <div v-if="showImageCropModal" class="crop-modal" @click.self="closeCropModal">
      <div class="crop-card" role="dialog" aria-modal="true" aria-label="Edit profile image">
        <h2>Edit Profile Image</h2>
        <p>Drag to recenter. Use resize slider to zoom.</p>

        <div
          class="crop-stage"
          @pointerdown="onCropPointerDown"
          @pointermove="onCropPointerMove"
          @pointerup="stopCropDrag"
          @pointercancel="stopCropDrag"
        >
          <img :src="cropImageUrl" alt="Crop preview" class="crop-image" :style="cropImageStyle()" />
        </div>

        <label class="crop-zoom">
          Resize
          <input type="range" min="1" max="3" step="0.01" :value="cropScale" @input="updateCropScale($event.target.value)" />
        </label>

        <div class="crop-actions">
          <button type="button" class="ghost" @click="recenterCropImage">Recenter</button>
          <button type="button" class="ghost" @click="closeCropModal">Cancel</button>
          <button type="button" @click="applyCroppedImage">Apply Crop</button>
        </div>
      </div>
    </div>

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

.avatar.clickable {
  cursor: zoom-in;
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

.crop-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(3, 13, 22, 0.78);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.crop-card {
  width: min(460px, 100%);
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.98), rgba(9, 59, 71, 0.9));
  padding: 0.9rem;
  display: grid;
  gap: 0.75rem;
}

.crop-card h2,
.crop-card p {
  margin: 0;
}

.crop-card p {
  color: #c7ffe8;
  font-size: 0.84rem;
}

.crop-stage {
  width: 280px;
  height: 280px;
  margin: 0 auto;
  border-radius: 12px;
  border: 1px solid rgba(133, 229, 197, 0.45);
  background: rgba(4, 20, 29, 0.85);
  overflow: hidden;
  position: relative;
  touch-action: none;
  cursor: grab;
}

.crop-stage:active {
  cursor: grabbing;
}

.crop-image {
  position: absolute;
  left: 50%;
  top: 50%;
  user-select: none;
  -webkit-user-drag: none;
}

.crop-zoom {
  display: grid;
  gap: 0.35rem;
}

.crop-actions {
  display: flex;
  gap: 0.45rem;
  justify-content: flex-end;
}

.crop-actions .ghost {
  background: transparent;
}

.viewer-modal {
  position: fixed;
  inset: 0;
  z-index: 1190;
  background: rgba(3, 13, 22, 0.78);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.viewer-card {
  width: min(520px, 100%);
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.98), rgba(9, 59, 71, 0.9));
  padding: 0.8rem;
  display: grid;
  gap: 0.65rem;
}

.viewer-image {
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 12px;
  background: rgba(4, 20, 29, 0.85);
}
</style>
