<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchMessagesWithTrader,
  fetchTraderMessageContacts,
  getTraderMessageStreamUrl,
  sendMessageToTrader,
} from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getUser } from '../../services/session';

const route = useRoute();
const router = useRouter();

const contacts = ref([]);
const messages = ref([]);
const selectedTraderId = ref(null);
const loadingContacts = ref(false);
const loadingMessages = ref(false);
const sending = ref(false);
const feedback = ref('');
const messageText = ref('');
const contactSearch = ref('');
const messageStream = ref(null);
const messageListRef = ref(null);
const MESSAGE_UPDATED_EVENT = 'cocolytics-messages-updated';
const threadOpened = ref(false);
const pendingTraderName = ref('');

const currentUserId = computed(() => Number(getUser()?.id || 0));

const selectedContact = computed(() => {
  if (!selectedTraderId.value) return null;
  return contacts.value.find((contact) => Number(contact.traderId) === Number(selectedTraderId.value)) || null;
});

const filteredContacts = computed(() => {
  const keyword = String(contactSearch.value || '').trim().toLowerCase();
  if (!keyword) return contacts.value;

  return contacts.value.filter((contact) => {
    const name = String(contact.traderName || '').toLowerCase();
    const last = String(contact.lastMessage || '').toLowerCase();
    return name.includes(keyword) || last.includes(keyword);
  });
});

const totalUnreadCount = computed(() => contacts.value.reduce(
  (total, contact) => total + Number(contact.unreadCount || 0),
  0
));

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function emitMessagesUpdated() {
  window.dispatchEvent(new CustomEvent(MESSAGE_UPDATED_EVENT));
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function normalizeMessageRow(row) {
  return {
    id: Number(row?.id ?? row?.message_id ?? 0),
    conversationId: Number(row?.conversationId ?? row?.conversation_id ?? 0) || null,
    senderId: Number(row?.senderId ?? row?.sender_id ?? 0),
    receiverId: Number(row?.receiverId ?? row?.receiver_id ?? 0),
    messageText: String(row?.messageText ?? row?.message_text ?? '').trim(),
    isRead: Boolean(Number(row?.isRead ?? row?.is_read ?? 0)),
    createdAt: row?.createdAt ?? row?.created_at ?? new Date().toISOString(),
  };
}

function messageDeliveryLabel(message) {
  if (Number(message.senderId) !== currentUserId.value) {
    return '';
  }

  return message.isRead ? 'Seen' : 'Delivered';
}

function scrollMessagesToBottom() {
  const target = messageListRef.value;
  if (!target) return;
  target.scrollTop = target.scrollHeight;
}

async function scrollMessagesToBottomAfterPaint() {
  await nextTick();
  scrollMessagesToBottom();
}

function upsertMessage(message) {
  const normalized = normalizeMessageRow(message);
  if (!normalized.id || normalized.senderId <= 0 || normalized.receiverId <= 0) {
    return;
  }

  const existingIndex = messages.value.findIndex((item) => Number(item.id) === Number(normalized.id));
  if (existingIndex >= 0) {
    messages.value.splice(existingIndex, 1, normalized);
  } else {
    messages.value.push(normalized);
  }

  messages.value.sort((a, b) => Number(a.id) - Number(b.id));
}

function closeMessageStream() {
  if (messageStream.value) {
    messageStream.value.close();
    messageStream.value = null;
  }
}

function handleLiveMessageEvent(rawEvent) {
  const payload = JSON.parse(rawEvent?.data || '{}');
  if (payload?.type !== 'message:new' || !payload?.message) {
    return;
  }

  const partnerId = Number(payload.partnerId);
  const selectedId = Number(selectedTraderId.value || 0);
  if (selectedId > 0 && partnerId === selectedId) {
    upsertMessage(payload.message);
    scrollMessagesToBottomAfterPaint();
  }

  loadContacts();
  emitMessagesUpdated();
}

function openMessageStream() {
  closeMessageStream();

  const streamUrl = getTraderMessageStreamUrl();
  if (!streamUrl) {
    return;
  }

  const stream = new EventSource(streamUrl);
  stream.addEventListener('chat-message', (event) => {
    try {
      handleLiveMessageEvent(event);
    } catch (error) {
      console.error('[messages] failed to parse live event', error);
    }
  });
  messageStream.value = stream;
}

function onComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

async function selectContact(traderId) {
  const parsedId = Number(traderId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return;
  }

  selectedTraderId.value = parsedId;
  threadOpened.value = true;
  router.replace({ name: 'trader-messages', query: { traderId: String(parsedId) } });
  await loadMessages();
  emitMessagesUpdated();
}

function backToChats() {
  threadOpened.value = false;
}

function syncThreadFromRouteQuery() {
  const parsedId = Number(route.query.traderId);
  if (Number.isInteger(parsedId) && parsedId > 0) {
    selectedTraderId.value = parsedId;
    threadOpened.value = true;
    pendingTraderName.value = String(route.query.traderName || '').trim();
    return true;
  }

  selectedTraderId.value = null;
  threadOpened.value = false;
  pendingTraderName.value = '';
  return false;
}

async function loadContacts() {
  loadingContacts.value = true;
  try {
    const data = await fetchTraderMessageContacts();
    contacts.value = data.contacts || [];
    if (contacts.value.length || !selectedTraderId.value) {
      feedback.value = '';
    }
    syncThreadFromRouteQuery();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    loadingContacts.value = false;
  }
}

async function loadMessages() {
  if (!selectedTraderId.value) {
    messages.value = [];
    return;
  }

  loadingMessages.value = true;
  try {
    const data = await fetchMessagesWithTrader(selectedTraderId.value);
    const rows = Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.items)
          ? data.items
          : [];
    messages.value = rows
      .map(normalizeMessageRow)
      .filter((row) => row.senderId > 0 && row.receiverId > 0);
    messages.value.sort((a, b) => Number(a.id) - Number(b.id));
    feedback.value = '';
    await scrollMessagesToBottomAfterPaint();
  } catch (error) {
    feedback.value = error.message || 'Could not fetch messages.';
  } finally {
    loadingMessages.value = false;
  }
}

async function sendMessage() {
  if (!selectedTraderId.value) {
    feedback.value = 'Please select a trader to message.';
    return;
  }

  const text = String(messageText.value || '').trim();
  if (!text) {
    return;
  }

  sending.value = true;
  try {
    const data = await sendMessageToTrader(selectedTraderId.value, text);
    if (data?.message) {
      upsertMessage(data.message);
    }
    messageText.value = '';
    await loadContacts();
    emitMessagesUpdated();
    await scrollMessagesToBottomAfterPaint();
  } catch (error) {
    feedback.value = error.message;
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  syncThreadFromRouteQuery();
  await loadContacts();
  await loadMessages();
  openMessageStream();
  emitMessagesUpdated();
});

onUnmounted(() => {
  closeMessageStream();
});

watch(
  () => route.query.traderId,
  async () => {
    const hadThread = syncThreadFromRouteQuery();
    if (!hadThread) {
      messages.value = [];
      return;
    }

    await loadMessages();
  }
);

watch(selectedTraderId, async () => {
  if (!selectedTraderId.value) {
    messages.value = [];
    emitMessagesUpdated();
    return;
  }

  await loadMessages();
  emitMessagesUpdated();
});
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Messages</p>
      <h1>Messenger</h1>
      <p class="sub">Chat with other traders in realtime.</p>
    </header>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <section class="chat-layout">
      <aside :class="['contacts-panel', { hidden: threadOpened }]">
        <div class="contacts-head">
          <h2>Chats</h2>
          <span v-if="totalUnreadCount > 0" class="unread-badge">{{ totalUnreadCount }}</span>
        </div>

        <input
          v-model="contactSearch"
          type="text"
          class="contacts-search"
          placeholder="Search Messenger"
        />

        <p v-if="loadingContacts" class="muted">Loading contacts...</p>
        <p v-else-if="!contacts.length" class="muted">No traders available.</p>
        <p v-else-if="!filteredContacts.length" class="muted">No matching chats.</p>

        <div v-else class="contacts-list">
          <button
            v-for="contact in filteredContacts"
            :key="contact.traderId"
            type="button"
            :class="['contact-item', { active: Number(contact.traderId) === Number(selectedTraderId) }]"
            @click="selectContact(contact.traderId)"
          >
            <img
              v-if="contact.profileImagePath"
              :src="toImageUrl(contact.profileImagePath)"
              :alt="contact.traderName"
              class="contact-avatar"
            />
            <div v-else class="contact-avatar placeholder">{{ (contact.traderName || 'T').slice(0, 1).toUpperCase() }}</div>

            <div class="contact-info">
              <p class="contact-name">{{ contact.traderName || 'Trader' }}</p>
              <p class="contact-last">{{ contact.lastMessage || 'No messages yet.' }}</p>
            </div>

            <span v-if="Number(contact.unreadCount) > 0" class="unread-badge">{{ contact.unreadCount }}</span>
          </button>
        </div>
      </aside>

      <section :class="['thread-panel', { hidden: !threadOpened }]">
        <header class="thread-head">
          <button type="button" class="back-chat-btn" @click="backToChats">Back</button>

          <div class="thread-user" v-if="selectedContact">
            <img
              v-if="selectedContact.profileImagePath"
              :src="toImageUrl(selectedContact.profileImagePath)"
              :alt="selectedContact.traderName"
              class="thread-avatar"
            />
            <div v-else class="thread-avatar placeholder">
              {{ (selectedContact.traderName || 'T').slice(0, 1).toUpperCase() }}
            </div>
            <div>
              <h2>{{ selectedContact.traderName }}</h2>
              <p class="thread-status">Active</p>
            </div>
          </div>
          <h2 v-else-if="pendingTraderName">{{ pendingTraderName }}</h2>
          <h2 v-else>Select a chat to start messaging</h2>
        </header>

        <p v-if="loadingMessages" class="muted">Loading messages...</p>
        <p v-else-if="threadOpened && !messages.length" class="muted">Start your conversation.</p>

        <div v-else ref="messageListRef" class="message-list">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['message-row', { mine: Number(message.senderId) === currentUserId }]"
          >
            <div v-if="Number(message.senderId) !== currentUserId" class="message-avatar">
              {{ (selectedContact?.traderName || pendingTraderName || 'T').slice(0, 1).toUpperCase() }}
            </div>
            <article :class="['message-bubble', { mine: Number(message.senderId) === currentUserId }]">
              <p>{{ message.messageText }}</p>
              <span>{{ formatDate(message.createdAt) }}</span>
              <small v-if="messageDeliveryLabel(message)" class="delivery-label">
                {{ messageDeliveryLabel(message) }}
              </small>
            </article>
          </div>
        </div>

        <form class="composer" @submit.prevent="sendMessage">
          <input
            v-model="messageText"
            type="text"
            placeholder="Type your message..."
            :disabled="sending || !selectedTraderId"
            @keydown="onComposerKeydown"
          />
          <button type="submit" :disabled="sending || !selectedTraderId">
            {{ sending ? '...' : 'Send' }}
          </button>
        </form>
      </section>
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

.head h1 {
  margin: 0.45rem 0 0;
}

.sub {
  margin: 0.35rem 0 0;
  color: #c8fce6;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffbfca;
}

.chat-layout {
  margin-top: 1rem;
  border: 1px solid rgba(90, 102, 120, 0.35);
  border-radius: 16px;
  background: #1f2329;
  padding: 0.55rem;
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 0.55rem;
  min-height: 72vh;
}

.contacts-panel,
.thread-panel {
  border: 1px solid rgba(76, 88, 106, 0.3);
  border-radius: 12px;
  background: #181b21;
  padding: 0.6rem;
}

.contacts-head h2,
.thread-head h2 {
  margin: 0;
  color: #eef3fb;
}

.contacts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.contacts-search {
  margin-top: 0.45rem;
  border: 1px solid rgba(91, 103, 125, 0.4);
  border-radius: 999px;
  background: #252a33;
  color: #ecf2ff;
  padding: 0.52rem 0.75rem;
  width: 100%;
}

.contacts-list {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.45rem;
  max-height: min(62vh, 520px);
  overflow-y: auto;
  overflow-x: hidden;
}

.contact-item {
  border: 1px solid rgba(91, 103, 125, 0.35);
  border-radius: 10px;
  background: #1f242d;
  padding: 0.45rem;
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 0.45rem;
  align-items: center;
  text-align: left;
}

.contact-item.active {
  border-color: rgba(73, 128, 255, 0.75);
  background: #24344f;
}

.contact-avatar {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 999px;
  border: 1px solid rgba(131, 236, 200, 0.35);
}

.contact-avatar.placeholder {
  display: grid;
  place-items: center;
  background: #2e333f;
  color: #e7fff4;
  font-weight: 900;
}

.contact-info p {
  margin: 0;
}

.contact-name {
  color: #eef3fb;
  font-weight: 700;
}

.contact-last {
  margin-top: 0.12rem;
  color: #acb7ca;
  font-size: 0.76rem;
}

.unread-badge {
  border-radius: 999px;
  border: 1px solid rgba(114, 156, 255, 0.62);
  background: #3272ff;
  color: #f3f7ff;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.08rem 0.42rem;
}

.thread-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.thread-head {
  border-bottom: 1px solid rgba(86, 97, 117, 0.38);
  padding-bottom: 0.5rem;
  display: grid;
  gap: 0.45rem;
}

.back-chat-btn {
  display: none;
  justify-self: start;
  border: 1px solid rgba(102, 140, 255, 0.55);
  border-radius: 999px;
  background: #24344f;
  color: #eef3fb;
  padding: 0.28rem 0.58rem;
  font-size: 0.76rem;
  font-weight: 700;
}

.thread-user {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.thread-avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid rgba(102, 114, 136, 0.4);
}

.thread-avatar.placeholder {
  display: grid;
  place-items: center;
  background: #2e333f;
  color: #e7fff4;
  font-weight: 900;
}

.thread-status {
  margin: 0.12rem 0 0;
  color: #9fb1c9;
  font-size: 0.75rem;
}

.message-list {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-height: 36vh;
  max-height: min(54vh, 560px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.2rem;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-avatar {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #2e333f;
  color: #eef3fb;
  font-size: 0.7rem;
  font-weight: 800;
  display: grid;
  place-items: center;
}

.message-bubble {
  max-width: min(92%, 500px);
  border: 1px solid rgba(89, 101, 124, 0.3);
  border-radius: 16px;
  background: #2c313a;
  padding: 0.5rem 0.62rem;
}

.message-bubble.mine {
  background: #3a5df8;
  border-color: rgba(122, 151, 255, 0.7);
}

.message-bubble p {
  margin: 0;
  color: #f4f7ff;
}

.message-bubble span {
  margin-top: 0.24rem;
  display: block;
  color: #ccd6e7;
  font-size: 0.7rem;
  text-align: right;
}

.delivery-label {
  margin-top: 0.18rem;
  display: block;
  color: #cbd7ff;
  font-size: 0.68rem;
  text-align: right;
  font-weight: 700;
}

.composer {
  margin-top: 0.45rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem;
}

.composer input {
  border: 1px solid rgba(92, 103, 124, 0.45);
  border-radius: 999px;
  background: #232831;
  color: #edf3ff;
  padding: 0.6rem 0.78rem;
  font: inherit;
}

.composer button {
  border: 1px solid rgba(102, 140, 255, 0.65);
  border-radius: 999px;
  background: #3666ff;
  color: #f4f7ff;
  padding: 0.58rem 0.82rem;
  font-weight: 800;
  cursor: pointer;
}

.muted {
  color: #c2f7e0;
  margin-top: 0.65rem;
}

@media (max-width: 900px) {
  .chat-layout {
    grid-template-columns: 1fr;
    min-height: 76vh;
  }

  .back-chat-btn {
    display: inline-flex;
    align-items: center;
  }

  .contacts-panel.hidden,
  .thread-panel.hidden {
    display: none;
  }

  .contacts-list {
    max-height: 54vh;
  }

  .message-list {
    max-height: 46vh;
  }
}
</style>
