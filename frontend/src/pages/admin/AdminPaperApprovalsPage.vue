<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import ConfirmationModal from '../../components/ConfirmationModal.vue';
import { fetchAdminPaperUploads, reviewAdminPaperUpload } from '../../services/api';
import { toMediaUrl } from '../../services/media';

const uploads = ref([]);
const loading = ref(false);
const feedback = ref('');
const reviewNotes = reactive({});
const savingIds = ref([]);
const showReviewModal = ref(false);
const reviewTarget = ref(null);

const pendingCount = computed(() => uploads.value.filter((item) => item.status === 'pending').length);

function toPaperLabel(type) {
  return type === 'to_cut' ? 'To Cut' : 'Transport';
}

function toStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Pending';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isSaving(uploadId) {
  return savingIds.value.includes(uploadId);
}

function setSaving(uploadId, saving) {
  if (saving) {
    if (!savingIds.value.includes(uploadId)) {
      savingIds.value = [...savingIds.value, uploadId];
    }
    return;
  }

  savingIds.value = savingIds.value.filter((id) => id !== uploadId);
}

async function loadUploads() {
  loading.value = true;
  feedback.value = '';
  try {
    const data = await fetchAdminPaperUploads();
    uploads.value = data.uploads || [];

    for (const item of uploads.value) {
      if (reviewNotes[item.id] === undefined) {
        reviewNotes[item.id] = item.reviewNotes || '';
      }
    }
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loading.value = false;
  }
}

function requestReview(upload, nextStatus) {
  reviewTarget.value = {
    id: upload.id,
    title: upload.title,
    status: nextStatus,
  };
  showReviewModal.value = true;
}

function cancelReview() {
  showReviewModal.value = false;
  reviewTarget.value = null;
}

async function confirmReview() {
  if (!reviewTarget.value) return;

  const uploadId = reviewTarget.value.id;
  const nextStatus = reviewTarget.value.status;
  const notes = String(reviewNotes[uploadId] || '').trim();

  setSaving(uploadId, true);
  try {
    await reviewAdminPaperUpload(uploadId, {
      status: nextStatus,
      reviewNotes: notes,
    });

    feedback.value = `Upload #${uploadId} marked as ${nextStatus}.`;
    cancelReview();
    await loadUploads();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    setSaving(uploadId, false);
  }
}

onMounted(loadUploads);
</script>

<template>
  <section class="page">
    <header>
      <p class="kicker">Admin Review</p>
      <h2>Paper Approvals</h2>
      <p class="sub">Review trader uploads and approve or reject submitted to cut and transport papers.</p>
      <p class="pending">Pending: {{ pendingCount }}</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trader</th>
            <th>Paper Type</th>
            <th>Title</th>
            <th>Description</th>
            <th>File</th>
            <th>Status</th>
            <th>Admin Notes</th>
            <th>Submitted</th>
            <th>Reviewed</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="10">Loading paper uploads...</td>
          </tr>
          <tr v-for="item in uploads" :key="item.id">
            <td>
              <strong>{{ item.traderName || 'Trader' }}</strong>
              <br />
              <span>{{ item.traderEmail || '-' }}</span>
            </td>
            <td>{{ toPaperLabel(item.paperType) }}</td>
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
            <td class="notes-cell">
              <textarea
                v-model="reviewNotes[item.id]"
                rows="2"
                :disabled="isSaving(item.id)"
                placeholder="Optional admin note"
              ></textarea>
            </td>
            <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
            <td>{{ item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : '-' }}</td>
            <td>
              <div class="actions">
                <button
                  type="button"
                  class="btn approve"
                  :disabled="isSaving(item.id)"
                  @click="requestReview(item, 'approved')"
                >
                  Approve
                </button>
                <button
                  type="button"
                  class="btn reject"
                  :disabled="isSaving(item.id)"
                  @click="requestReview(item, 'rejected')"
                >
                  Reject
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && uploads.length === 0">
            <td colspan="10">No paper uploads found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmationModal
      :visible="showReviewModal"
      title="Confirm Paper Review"
      :message="`Mark ${reviewTarget?.title || 'this upload'} as ${reviewTarget?.status || 'approved'}?`"
      confirm-label="Confirm"
      cancel-label="Cancel"
      @confirm="confirmReview"
      @cancel="cancelReview"
    />
  </section>
</template>

<style scoped>
.page {
  color: #e7f3ff;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #8dd7ff;
}

h2 {
  margin: 0.5rem 0 0;
  font-size: 1.45rem;
}

.sub {
  margin: 0.45rem 0 0;
  color: #c2ddf7;
}

.pending {
  margin: 0.45rem 0 0;
  color: #ffd9ae;
  font-weight: 800;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffbac7;
}

.table-wrap {
  margin-top: 1rem;
  border: 1px solid rgba(139, 211, 255, 0.24);
  border-radius: 12px;
  overflow: auto;
  background: rgba(9, 31, 48, 0.78);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1240px;
}

th,
td {
  padding: 0.72rem;
  border-bottom: 1px solid rgba(138, 209, 255, 0.16);
  text-align: left;
  vertical-align: top;
  font-size: 0.82rem;
}

a {
  color: #99d8ff;
}

.notes-cell textarea {
  width: 220px;
  max-width: 100%;
  border: 1px solid rgba(133, 208, 255, 0.34);
  border-radius: 8px;
  background: rgba(8, 27, 40, 0.84);
  color: #e7f3ff;
  padding: 0.42rem 0.5rem;
  font: inherit;
}

.status {
  border: 1px solid rgba(131, 204, 255, 0.35);
  border-radius: 999px;
  padding: 0.1rem 0.42rem;
  font-weight: 700;
  font-size: 0.72rem;
}

.status.pending {
  border-color: rgba(255, 214, 141, 0.42);
  color: #ffe2b7;
}

.status.approved {
  border-color: rgba(146, 248, 183, 0.45);
  color: #d8ffea;
}

.status.rejected {
  border-color: rgba(255, 150, 165, 0.45);
  color: #ffd8df;
}

.actions {
  display: grid;
  gap: 0.35rem;
}

.btn {
  border: 1px solid rgba(133, 208, 255, 0.4);
  border-radius: 8px;
  padding: 0.36rem 0.56rem;
  color: #ecf7ff;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.btn.approve {
  border-color: rgba(126, 226, 191, 0.42);
  background: rgba(22, 117, 90, 0.78);
}

.btn.reject {
  border-color: rgba(255, 149, 166, 0.42);
  background: rgba(158, 35, 61, 0.82);
}

.btn:disabled {
  opacity: 0.65;
  cursor: wait;
}
</style>
