<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { fetchTraderPaperUploads, uploadTraderPaper } from '../../services/api';
import { toMediaUrl } from '../../services/media';

const uploads = ref([]);
const loading = ref(false);
const feedback = ref('');
const uploadingType = ref('');

const cutForm = reactive({
  title: '',
  description: '',
  file: null,
});

const transportForm = reactive({
  title: '',
  description: '',
  file: null,
});

const cutUploads = computed(() => uploads.value.filter((item) => item.paperType === 'to_cut'));
const transportUploads = computed(() => uploads.value.filter((item) => item.paperType === 'transport'));

function toPaperLabel(type) {
  return type === 'to_cut' ? 'To Cut' : 'Transport';
}

function toStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Pending';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function onPickFile(type, event) {
  const [selected] = event.target.files || [];
  if (type === 'to_cut') {
    cutForm.file = selected || null;
    return;
  }

  transportForm.file = selected || null;
}

function clearForm(type) {
  if (type === 'to_cut') {
    cutForm.title = '';
    cutForm.description = '';
    cutForm.file = null;
    return;
  }

  transportForm.title = '';
  transportForm.description = '';
  transportForm.file = null;
}

async function loadUploads() {
  loading.value = true;
  try {
    const data = await fetchTraderPaperUploads();
    uploads.value = data.uploads || [];
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function submitUpload(type) {
  const form = type === 'to_cut' ? cutForm : transportForm;

  if (!form.title.trim()) {
    feedback.value = 'Document title is required.';
    return;
  }

  if (!form.file) {
    feedback.value = 'Please attach a file before uploading.';
    return;
  }

  uploadingType.value = type;
  feedback.value = '';

  try {
    await uploadTraderPaper({
      paperType: type,
      title: form.title,
      description: form.description,
      paperFile: form.file,
    });

    clearForm(type);
    feedback.value = `${toPaperLabel(type)} document uploaded and is now pending admin review.`;
    await loadUploads();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    uploadingType.value = '';
  }
}

onMounted(loadUploads);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Trader Documents</p>
      <h1>Paper Uploads</h1>
      <p class="sub">Upload your to cut and transport papers for admin review and track approval status.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section class="upload-grid">
      <article class="upload-card">
        <h2>To Cut Papers</h2>
        <p class="card-sub">Upload documents for cutting authorization.</p>

        <label>
          Document Title
          <input v-model="cutForm.title" type="text" placeholder="e.g., Cutting Order #123" />
        </label>

        <label>
          Description (optional)
          <textarea
            v-model="cutForm.description"
            rows="3"
            placeholder="Details about the cutting documents..."
          ></textarea>
        </label>

        <label>
          Attach File
          <input type="file" @change="onPickFile('to_cut', $event)" />
        </label>

        <button
          type="button"
          class="action-btn"
          :disabled="uploadingType === 'to_cut'"
          @click="submitUpload('to_cut')"
        >
          {{ uploadingType === 'to_cut' ? 'Uploading...' : 'Upload To Cut Paper' }}
        </button>
      </article>

      <article class="upload-card">
        <h2>Transport Papers</h2>
        <p class="card-sub">Upload documents for transport logistics and movement clearance.</p>

        <label>
          Document Title
          <input v-model="transportForm.title" type="text" placeholder="e.g., Transport Manifest #456" />
        </label>

        <label>
          Description (optional)
          <textarea
            v-model="transportForm.description"
            rows="3"
            placeholder="Details about the transport documents..."
          ></textarea>
        </label>

        <label>
          Attach File
          <input type="file" @change="onPickFile('transport', $event)" />
        </label>

        <button
          type="button"
          class="action-btn alt"
          :disabled="uploadingType === 'transport'"
          @click="submitUpload('transport')"
        >
          {{ uploadingType === 'transport' ? 'Uploading...' : 'Upload Transport Paper' }}
        </button>
      </article>
    </section>

    <section class="table-panel">
      <h2>To Cut Uploads</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Description</th>
              <th>File</th>
              <th>Status</th>
              <th>Admin Notes</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6">Loading uploads...</td>
            </tr>
            <tr v-for="item in cutUploads" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.description || '-' }}</td>
              <td>
                <a :href="toMediaUrl(item.filePath)" target="_blank" rel="noopener noreferrer">
                  {{ item.originalFileName }}
                </a>
              </td>
              <td>
                <span :class="['status', item.status]">{{ toStatusLabel(item.status) }}</span>
              </td>
              <td>{{ item.reviewNotes || '-' }}</td>
              <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
            </tr>
            <tr v-if="!loading && !cutUploads.length">
              <td colspan="6">No to cut uploads yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="table-panel">
      <h2>Transport Uploads</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Description</th>
              <th>File</th>
              <th>Status</th>
              <th>Admin Notes</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6">Loading uploads...</td>
            </tr>
            <tr v-for="item in transportUploads" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.description || '-' }}</td>
              <td>
                <a :href="toMediaUrl(item.filePath)" target="_blank" rel="noopener noreferrer">
                  {{ item.originalFileName }}
                </a>
              </td>
              <td>
                <span :class="['status', item.status]">{{ toStatusLabel(item.status) }}</span>
              </td>
              <td>{{ item.reviewNotes || '-' }}</td>
              <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
            </tr>
            <tr v-if="!loading && !transportUploads.length">
              <td colspan="6">No transport uploads yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
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

h1 {
  margin: 0.45rem 0 0;
}

.sub {
  margin: 0.35rem 0 0;
  color: #c8fce6;
}

.feedback {
  margin-top: 0.85rem;
  color: #c9ffd5;
}

.upload-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.9rem;
}

.upload-card {
  border: 1px solid rgba(113, 215, 177, 0.35);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.88), rgba(9, 59, 71, 0.68));
  padding: 0.9rem;
  display: grid;
  gap: 0.6rem;
}

.upload-card h2 {
  margin: 0;
  font-size: 1.18rem;
}

.card-sub {
  margin: -0.1rem 0 0;
  color: #c8fce6;
  font-size: 0.86rem;
}

label {
  display: grid;
  gap: 0.34rem;
  color: #ddfff2;
  font-weight: 700;
}

input,
textarea {
  width: 100%;
  border: 1px solid rgba(133, 229, 197, 0.42);
  border-radius: 10px;
  background: rgba(5, 27, 37, 0.78);
  color: #ecfff7;
  padding: 0.56rem 0.66rem;
  font: inherit;
}

.action-btn {
  margin-top: 0.2rem;
  border: 1px solid rgba(149, 142, 255, 0.42);
  border-radius: 10px;
  background: linear-gradient(120deg, rgba(108, 120, 255, 0.9), rgba(130, 84, 213, 0.88));
  color: #f0edff;
  padding: 0.6rem 0.75rem;
  font-weight: 800;
  cursor: pointer;
}

.action-btn.alt {
  border-color: rgba(255, 145, 187, 0.45);
  background: linear-gradient(120deg, rgba(235, 108, 182, 0.9), rgba(247, 86, 109, 0.88));
}

.action-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.table-panel {
  margin-top: 1rem;
  border: 1px solid rgba(113, 215, 177, 0.32);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(8, 35, 46, 0.84), rgba(9, 59, 71, 0.62));
  padding: 0.8rem;
}

.table-panel h2 {
  margin: 0;
  font-size: 1.06rem;
}

.table-wrap {
  margin-top: 0.66rem;
  overflow: auto;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  border-bottom: 1px solid rgba(131, 226, 195, 0.18);
  padding: 0.55rem 0.52rem;
  font-size: 0.83rem;
  vertical-align: top;
}

a {
  color: #9ef6ce;
}

.status {
  border: 1px solid rgba(131, 228, 194, 0.45);
  border-radius: 999px;
  padding: 0.1rem 0.42rem;
  font-weight: 700;
  font-size: 0.74rem;
}

.status.pending {
  border-color: rgba(255, 214, 141, 0.45);
  color: #ffe4b9;
}

.status.approved {
  border-color: rgba(146, 248, 183, 0.45);
  color: #d8ffea;
}

.status.rejected {
  border-color: rgba(255, 150, 165, 0.45);
  color: #ffd8df;
}

@media (min-width: 900px) {
  .upload-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
