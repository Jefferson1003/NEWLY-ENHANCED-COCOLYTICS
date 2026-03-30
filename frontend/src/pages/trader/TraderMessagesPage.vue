<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchMessagesWithTrader,
  fetchTraderMessageContacts,
  heartbeatTraderMessagePresence,
  getTraderMessageStreamUrl,
  sendMessageToTrader,
  sendTraderTypingStatus,
} from '../../services/api';
import { toMediaUrl } from '../../services/media';
import { getUser } from '../../services/session';

const route = useRoute();
const router = useRouter();

const contacts = ref([]);
const messages = ref([]);
const callLogs = ref([]);
const selectedTraderId = ref(null);
const loadingContacts = ref(false);
const loadingMessages = ref(false);
const sending = ref(false);
const feedback = ref('');
const messageText = ref('');
const messageImageInputRef = ref(null);
const selectedMessageImageFile = ref(null);
const selectedMessageImagePreview = ref('');
const contactSearch = ref('');
const messageStream = ref(null);
const messageListRef = ref(null);
const MESSAGE_UPDATED_EVENT = 'cocolytics-messages-updated';
const threadOpened = ref(false);
const pendingTraderName = ref('');
const replyToMessage = ref(null);
const nowTick = ref(Date.now());
const typingByPartnerId = ref({});

let presenceTimer = null;
let nowTicker = null;
let typingStopTimer = null;
const typingResetTimers = new Map();
let lastTypingSignalAt = 0;
const SWIPE_REPLY_TRIGGER_PX = 56;
const SWIPE_REPLY_MAX_PX = 72;

const swipeState = ref({
  active: false,
  dragging: false,
  pointerId: null,
  messageId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
});

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

const conversationItems = computed(() => {
  const messageItems = messages.value.map((message) => ({
    type: 'message',
    id: `message-${message.id}`,
    sortAt: new Date(message.createdAt).getTime() || 0,
    message,
  }));

  const callItems = callLogs.value.map((call) => ({
    type: 'call',
    id: `call-${call.id}`,
    sortAt: new Date(call.startedAt || call.createdAt).getTime() || 0,
    call,
  }));

  return [...messageItems, ...callItems].sort((a, b) => a.sortAt - b.sortAt);
});

function toImageUrl(path) {
  if (!path) return '';
  return toMediaUrl(path);
}

function selectedContactAvatarUrl() {
  const imagePath = selectedContact.value?.profileImagePath || '';
  return imagePath ? toImageUrl(imagePath) : '';
}

function emitMessagesUpdated() {
  window.dispatchEvent(new CustomEvent(MESSAGE_UPDATED_EVENT));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString();
}

function normalizeMessageRow(row) {
  return {
    id: Number(row?.id ?? row?.message_id ?? 0),
    conversationId: Number(row?.conversationId ?? row?.conversation_id ?? 0) || null,
    senderId: Number(row?.senderId ?? row?.sender_id ?? 0),
    receiverId: Number(row?.receiverId ?? row?.receiver_id ?? 0),
    messageText: String(row?.messageText ?? row?.message_text ?? '').trim(),
    messageImagePath: String(row?.messageImagePath ?? row?.message_image_path ?? '').trim(),
    replyToMessageId: Number(row?.replyToMessageId ?? row?.reply_to_message_id ?? 0) || null,
    replyToMessageText: String(row?.replyToMessageText ?? row?.reply_to_message_text ?? '').trim(),
    replyToSenderId: Number(row?.replyToSenderId ?? row?.reply_to_sender_id ?? 0) || null,
    isRead: Boolean(Number(row?.isRead ?? row?.is_read ?? 0)),
    createdAt: row?.createdAt ?? row?.created_at ?? new Date().toISOString(),
  };
}

function normalizeCallLogRow(row) {
  return {
    id: Number(row?.id || 0),
    callerId: Number(row?.callerId ?? row?.caller_id ?? 0),
    calleeId: Number(row?.calleeId ?? row?.callee_id ?? 0),
    callMode: String(row?.callMode ?? row?.call_mode ?? 'audio').toLowerCase() === 'video' ? 'video' : 'audio',
    status: String(row?.status || '').toLowerCase(),
    startedAt: row?.startedAt ?? row?.started_at ?? row?.createdAt ?? new Date().toISOString(),
    endedAt: row?.endedAt ?? row?.ended_at ?? null,
    durationSeconds: Math.max(0, Number(row?.durationSeconds ?? row?.duration_seconds ?? 0) || 0),
    createdAt: row?.createdAt ?? row?.created_at ?? row?.startedAt ?? new Date().toISOString(),
  };
}

function formatCallDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  if (!minutes) {
    return `${remaining}s`;
  }

  return `${minutes}m ${remaining}s`;
}

function callSummaryText(call) {
  const mine = Number(call.callerId) === currentUserId.value;
  const modeLabel = call.callMode === 'video' ? 'video call' : 'voice call';
  const status = String(call.status || '').toLowerCase();

  if (status === 'missed') {
    return mine ? `Missed outgoing ${modeLabel}` : `Missed ${modeLabel}`;
  }

  if (status === 'declined') {
    return mine ? `${modeLabel} declined` : `You declined ${modeLabel}`;
  }

  if (status === 'completed') {
    return `${mine ? 'Outgoing' : 'Incoming'} ${modeLabel} • ${formatCallDuration(call.durationSeconds)}`;
  }

  if (status === 'ringing') {
    return `${mine ? 'Outgoing' : 'Incoming'} ${modeLabel} • ringing`;
  }

  return `${mine ? 'Outgoing' : 'Incoming'} ${modeLabel}`;
}

function toRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  const diffMs = Math.max(0, nowTick.value - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= 0) {
    return 'just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function contactStatusLabel(contact) {
  if (isPartnerTyping(contact?.traderId)) {
    return 'Typing...';
  }

  if (contact?.isOnline) {
    return 'Active now';
  }

  const fallbackLastActiveAt = contact?.lastSeenAt || contact?.lastMessageAt || null;
  if (fallbackLastActiveAt) {
    return `Active ${toRelativeTime(fallbackLastActiveAt)}`;
  }

  return 'Active recently';
}

function threadStatusLabel() {
  if (!selectedContact.value) {
    return '';
  }

  if (isPartnerTyping(selectedContact.value.traderId)) {
    return 'Typing...';
  }

  return contactStatusLabel(selectedContact.value);
}

function isPartnerTyping(partnerId) {
  const parsedId = Number(partnerId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return false;
  }

  return Boolean(typingByPartnerId.value[parsedId]);
}

function setPartnerTyping(partnerId, isTyping) {
  const parsedId = Number(partnerId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return;
  }

  const currentMap = { ...typingByPartnerId.value, [parsedId]: Boolean(isTyping) };
  typingByPartnerId.value = currentMap;

  const existingTimer = typingResetTimers.get(parsedId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    typingResetTimers.delete(parsedId);
  }

  if (isTyping) {
    const timeoutId = setTimeout(() => {
      typingByPartnerId.value = { ...typingByPartnerId.value, [parsedId]: false };
      typingResetTimers.delete(parsedId);
    }, 3200);
    typingResetTimers.set(parsedId, timeoutId);
  }
}

function roleBadgeLabel(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'client') return 'CLIENT';
  if (normalized === 'trader') return 'TRADER';
  return 'USER';
}

function roleBadgeClass(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'client') return 'client';
  if (normalized === 'trader') return 'trader';
  return 'user';
}

function isMessageMine(message) {
  return Number(message.senderId) === currentUserId.value;
}

function replyToName(message) {
  if (!message?.replyToSenderId) {
    return 'Message';
  }

  if (Number(message.replyToSenderId) === currentUserId.value) {
    return 'You';
  }

  return selectedContact.value?.traderName || pendingTraderName.value || 'Trader';
}

function messageDeliveryLabel(message) {
  if (!isMessageMine(message)) {
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

function handleLivePresenceEvent(rawEvent) {
  const payload = JSON.parse(rawEvent?.data || '{}');

  if (payload?.type === 'typing:update') {
    setPartnerTyping(payload?.traderId, Boolean(payload?.isTyping));
    return;
  }

  if (payload?.type !== 'presence:update') {
    return;
  }

  loadContacts();
}

async function sendTypingSignal(isTyping) {
  const partnerId = Number(selectedTraderId.value || 0);
  if (!Number.isInteger(partnerId) || partnerId <= 0) {
    return;
  }

  try {
    await sendTraderTypingStatus(partnerId, isTyping);
  } catch {
    // Typing signal failures should not interrupt chat flow.
  }
}

function clearTypingStopTimer() {
  if (typingStopTimer) {
    clearTimeout(typingStopTimer);
    typingStopTimer = null;
  }
}

function onComposerInput() {
  const hasText = String(messageText.value || '').trim().length > 0;

  if (!hasText) {
    clearTypingStopTimer();
    sendTypingSignal(false);
    return;
  }

  const now = Date.now();
  if ((now - lastTypingSignalAt) >= 1300) {
    lastTypingSignalAt = now;
    sendTypingSignal(true);
  }

  clearTypingStopTimer();
  typingStopTimer = setTimeout(() => {
    sendTypingSignal(false);
  }, 1500);
}

function openCallPage(mode = 'audio') {
  const partnerId = Number(selectedTraderId.value);
  if (!Number.isInteger(partnerId) || partnerId <= 0) {
    feedback.value = 'Please select a user first.';
    return;
  }

  router.push({
    name: 'trader-call',
    query: {
      traderId: String(partnerId),
      mode: mode === 'video' ? 'video' : 'audio',
    },
  });
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
  stream.addEventListener('chat-presence', (event) => {
    try {
      handleLivePresenceEvent(event);
    } catch (error) {
      console.error('[messages] failed to parse presence event', error);
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
  if (Number(selectedTraderId.value || 0) > 0 && Number(selectedTraderId.value) !== Number(traderId)) {
    sendTypingSignal(false);
  }

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
  sendTypingSignal(false);
  threadOpened.value = false;
}

function selectReplyMessage(message) {
  replyToMessage.value = {
    id: message.id,
    messageText: message.messageText,
    senderId: message.senderId,
  };
}

function clearReplyMessage() {
  replyToMessage.value = null;
}

function clearSelectedMessageImage() {
  if (selectedMessageImagePreview.value) {
    URL.revokeObjectURL(selectedMessageImagePreview.value);
  }
  selectedMessageImageFile.value = null;
  selectedMessageImagePreview.value = '';
  if (messageImageInputRef.value) {
    messageImageInputRef.value.value = '';
  }
}

function openMessageImagePicker() {
  messageImageInputRef.value?.click?.();
}

function onMessageImageSelected(event) {
  const file = event?.target?.files?.[0] || null;
  if (!file) {
    clearSelectedMessageImage();
    return;
  }

  if (!String(file.type || '').startsWith('image/')) {
    feedback.value = 'Please select a valid image file.';
    clearSelectedMessageImage();
    return;
  }

  selectedMessageImageFile.value = file;
  selectedMessageImagePreview.value = URL.createObjectURL(file);
  feedback.value = '';
}

function replyPreviewName() {
  if (!replyToMessage.value) {
    return '';
  }

  return Number(replyToMessage.value.senderId) === currentUserId.value
    ? 'You'
    : selectedContact.value?.traderName || pendingTraderName.value || 'Trader';
}

function resetSwipeState() {
  swipeState.value = {
    active: false,
    dragging: false,
    pointerId: null,
    messageId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
  };
}

function onMessagePointerDown(message, event) {
  if (!message?.id) {
    return;
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  swipeState.value = {
    active: true,
    dragging: false,
    pointerId: event.pointerId,
    messageId: Number(message.id),
    startX: Number(event.clientX || 0),
    startY: Number(event.clientY || 0),
    currentX: 0,
  };

  event.currentTarget?.setPointerCapture?.(event.pointerId);
}

function onMessagePointerMove(message, event) {
  if (!swipeState.value.active) {
    return;
  }

  if (swipeState.value.pointerId !== event.pointerId) {
    return;
  }

  if (Number(message?.id) !== Number(swipeState.value.messageId)) {
    return;
  }

  const deltaX = Number(event.clientX || 0) - swipeState.value.startX;
  const deltaY = Number(event.clientY || 0) - swipeState.value.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (!swipeState.value.dragging) {
    if (absX < 10) {
      return;
    }

    if (absY > absX) {
      resetSwipeState();
      return;
    }

    swipeState.value.dragging = true;
  }

  event.preventDefault();
  swipeState.value.currentX = Math.max(-SWIPE_REPLY_MAX_PX, Math.min(SWIPE_REPLY_MAX_PX, deltaX));
}

function onMessagePointerUp(message, event) {
  if (!swipeState.value.active) {
    return;
  }

  if (swipeState.value.pointerId !== event.pointerId) {
    return;
  }

  const messageMatches = Number(message?.id) === Number(swipeState.value.messageId);
  const shouldReply = messageMatches && Math.abs(swipeState.value.currentX) >= SWIPE_REPLY_TRIGGER_PX;

  if (shouldReply) {
    selectReplyMessage(message);
  }

  resetSwipeState();
}

function onMessagePointerCancel() {
  resetSwipeState();
}

function messageSwipeStyle(message) {
  if (!swipeState.value.active) {
    return {};
  }

  if (Number(message?.id) !== Number(swipeState.value.messageId)) {
    return {};
  }

  return {
    transform: `translateX(${swipeState.value.currentX}px)`,
  };
}

async function heartbeatPresence() {
  try {
    await heartbeatTraderMessagePresence();
  } catch {
    // Presence heartbeat intentionally fails silently.
  }
}

function startPresenceHeartbeat() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
  }

  heartbeatPresence();
  presenceTimer = setInterval(() => {
    heartbeatPresence();
  }, 20000);
}

function stopPresenceHeartbeat() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
}

function startNowTicker() {
  if (nowTicker) {
    clearInterval(nowTicker);
  }

  nowTicker = setInterval(() => {
    nowTick.value = Date.now();
  }, 30000);
}

function stopNowTicker() {
  if (nowTicker) {
    clearInterval(nowTicker);
    nowTicker = null;
  }
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
    callLogs.value = [];
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
    callLogs.value = (Array.isArray(data?.callLogs) ? data.callLogs : [])
      .map(normalizeCallLogRow)
      .filter((row) => row.id > 0 && row.callerId > 0 && row.calleeId > 0);
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
    feedback.value = 'Please select a user to message.';
    return;
  }

  const text = String(messageText.value || '').trim();
  if (!text && !selectedMessageImageFile.value) {
    return;
  }

  clearTypingStopTimer();
  await sendTypingSignal(false);

  sending.value = true;
  try {
    const data = await sendMessageToTrader(selectedTraderId.value, text, {
      replyToMessageId: replyToMessage.value?.id || null,
      messageImageFile: selectedMessageImageFile.value || null,
    });
    if (data?.message) {
      upsertMessage(data.message);
    }
    messageText.value = '';
    clearReplyMessage();
    clearSelectedMessageImage();
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
  startPresenceHeartbeat();
  startNowTicker();
  emitMessagesUpdated();
});

onUnmounted(() => {
  if (selectedMessageImagePreview.value) {
    URL.revokeObjectURL(selectedMessageImagePreview.value);
  }
  clearTypingStopTimer();
  typingResetTimers.forEach((timerId) => clearTimeout(timerId));
  typingResetTimers.clear();
  sendTypingSignal(false);
  stopPresenceHeartbeat();
  stopNowTicker();
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
      <p class="sub">Chat with all users in realtime.</p>
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
        <p v-else-if="!contacts.length" class="muted">No users available.</p>
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
              <p class="contact-name-row">
                <span class="contact-name">{{ contact.traderName || 'User' }}</span>
                <span class="role-badge" :class="roleBadgeClass(contact.partnerRole)">
                  {{ roleBadgeLabel(contact.partnerRole) }}
                </span>
              </p>
              <p class="contact-presence" :class="{ online: contact.isOnline, typing: isPartnerTyping(contact.traderId) }">
                <span class="presence-dot" />
                {{ contactStatusLabel(contact) }}
              </p>
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
              <div class="thread-user-name-row">
                <h2>{{ selectedContact.traderName || 'User' }}</h2>
                <span class="role-badge" :class="roleBadgeClass(selectedContact.partnerRole)">
                  {{ roleBadgeLabel(selectedContact.partnerRole) }}
                </span>
              </div>
              <p class="thread-status" :class="{ online: selectedContact.isOnline, typing: isPartnerTyping(selectedContact?.traderId) }">
                <span class="presence-dot" />
                {{ threadStatusLabel() }}
              </p>
            </div>
          </div>
          <div v-if="selectedContact" class="thread-actions">
            <button type="button" class="call-btn icon" @click="openCallPage('audio')" title="Voice call" aria-label="Voice call">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l2.5 2.5c3-3 8-3 11 0L20 16c-4-4.5-12-4.5-16 0z" /></svg>
            </button>
            <button type="button" class="call-btn icon video" @click="openCallPage('video')" title="Video call" aria-label="Video call">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h12l5-3v16l-5-3H3z" /></svg>
            </button>
          </div>
          <h2 v-else-if="pendingTraderName">{{ pendingTraderName }}</h2>
          <h2 v-else>Select a chat to start messaging</h2>
        </header>

        <p v-if="loadingMessages" class="muted">Loading messages...</p>
        <p v-else-if="threadOpened && !conversationItems.length" class="muted">Start your conversation.</p>

        <div v-else ref="messageListRef" class="message-list">
          <div
            v-for="item in conversationItems"
            :key="item.id"
            :class="['message-row', { mine: item.type === 'message' && Number(item.message.senderId) === currentUserId, call: item.type === 'call' }]"
          >
            <img
              v-if="item.type === 'message' && Number(item.message.senderId) !== currentUserId && selectedContactAvatarUrl()"
              :src="selectedContactAvatarUrl()"
              :alt="selectedContact?.traderName || 'Trader'"
              class="message-avatar message-avatar-photo"
            />
            <div
              v-else-if="item.type === 'message' && Number(item.message.senderId) !== currentUserId"
              class="message-avatar"
            >
              {{ (selectedContact?.traderName || pendingTraderName || 'T').slice(0, 1).toUpperCase() }}
            </div>
            <article
              v-if="item.type === 'message'"
              :class="['message-bubble', { mine: Number(item.message.senderId) === currentUserId, swiping: Number(item.message.id) === Number(swipeState.messageId) && swipeState.dragging }]"
              :style="messageSwipeStyle(item.message)"
              @pointerdown="onMessagePointerDown(item.message, $event)"
              @pointermove="onMessagePointerMove(item.message, $event)"
              @pointerup="onMessagePointerUp(item.message, $event)"
              @pointercancel="onMessagePointerCancel"
            >
              <div v-if="item.message.replyToMessageId" class="reply-quote">
                <small>{{ replyToName(item.message) }}</small>
                <p>{{ item.message.replyToMessageText || 'Original message unavailable.' }}</p>
              </div>
              <p v-if="item.message.messageText">{{ item.message.messageText }}</p>
              <a
                v-if="item.message.messageImagePath"
                :href="toImageUrl(item.message.messageImagePath)"
                class="message-image-link"
                target="_blank"
                rel="noopener noreferrer"
                :download="`message-${item.message.id}.jpg`"
              >
                <img
                  :src="toImageUrl(item.message.messageImagePath)"
                  alt="Message attachment"
                  class="message-image"
                />
              </a>
              <span>{{ formatDate(item.message.createdAt) }}</span>
              <small v-if="messageDeliveryLabel(item.message)" class="delivery-label">
                {{ messageDeliveryLabel(item.message) }}
              </small>
            </article>

            <article v-else class="call-log-bubble">
              <p class="call-log-title">{{ callSummaryText(item.call) }}</p>
              <span>{{ formatDate(item.call.startedAt || item.call.createdAt) }}</span>
            </article>
          </div>
        </div>

        <form class="composer" @submit.prevent="sendMessage">
          <div v-if="replyToMessage" class="reply-preview">
            <p>Replying to {{ replyPreviewName() }}</p>
            <small>{{ replyToMessage.messageText }}</small>
            <button type="button" @click="clearReplyMessage">Cancel</button>
          </div>
          <div v-if="selectedMessageImagePreview" class="image-preview">
            <img :src="selectedMessageImagePreview" alt="Selected attachment" />
            <button type="button" @click="clearSelectedMessageImage">Remove image</button>
          </div>
          <input
            ref="messageImageInputRef"
            type="file"
            accept="image/*"
            class="hidden-file-input"
            @change="onMessageImageSelected"
          />
          <input
            v-model="messageText"
            type="text"
            placeholder="Type your message..."
            :disabled="sending || !selectedTraderId"
            @input="onComposerInput"
            @keydown="onComposerKeydown"
          />
          <button
            type="button"
            class="icon-action-btn attach-btn"
            :disabled="sending || !selectedTraderId"
            @click="openMessageImagePicker"
            title="Attach image"
            aria-label="Attach image"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 11A2.5 2.5 0 1 1 11 8.5 2.5 2.5 0 0 1 8.5 11zm-3.5 8 4.5-6 3.5 4.5 2.5-3L19 19z"/>
            </svg>
          </button>
          <button
            type="submit"
            class="icon-action-btn send-btn"
            :disabled="sending || !selectedTraderId"
            title="Send message"
            aria-label="Send message"
          >
            <svg v-if="sending" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1zm0 12a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1zm8-5a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2h3zM7 12a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h3a1 1 0 0 1 1 1zm10.36-5.95a1 1 0 0 1 1.41 1.41l-2.12 2.12a1 1 0 1 1-1.41-1.41zm-9.9 9.9a1 1 0 0 1 1.41 1.41l-2.12 2.12a1 1 0 1 1-1.41-1.41zm0-9.9L5.34 8.17A1 1 0 1 1 3.93 6.76l2.12-2.12a1 1 0 0 1 1.41 1.41zm9.9 9.9 2.12 2.12a1 1 0 0 1-1.41 1.41l-2.12-2.12a1 1 0 1 1 1.41-1.41z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.4 20.4 20.85 12 3.4 3.6v6.2l12.5 2.2-12.5 2.2z"/>
            </svg>
          </button>
        </form>
      </section>
    </section>

  </section>
</template>

<style scoped>
.page {
  color: #e8edf5;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: #8ec8c0;
}

.head h1 {
  margin: 0.45rem 0 0;
}

.sub {
  margin: 0.35rem 0 0;
  color: #aeb8c6;
}

.feedback {
  margin-top: 0.8rem;
  color: #ffb4bf;
}

.chat-layout {
  margin-top: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: #171b22;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 0.75rem;
  min-height: 72vh;
}

.contacts-panel,
.thread-panel {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  background: #131821;
  padding: 0.75rem;
}

.contacts-head h2,
.thread-head h2 {
  margin: 0;
  color: #f3f6fb;
}

.contacts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.contacts-search {
  margin-top: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: #0f141d;
  color: #e7ecf5;
  padding: 0.58rem 0.78rem;
  width: 100%;
}

.contacts-list {
  margin-top: 0.7rem;
  display: grid;
  gap: 0.5rem;
  max-height: min(62vh, 520px);
  overflow-y: auto;
  overflow-x: hidden;
}

.contact-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: #171d28;
  padding: 0.55rem 0.6rem;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 0.55rem;
  align-items: start;
  text-align: left;
}

.contact-item.active {
  border-color: rgba(111, 140, 255, 0.85);
  background: #1d2433;
}

.contact-avatar {
  width: 42px;
  height: 42px;
  object-fit: cover;
  border-radius: 999px;
  border: 1px solid rgba(156, 172, 198, 0.45);
}

.contact-avatar.placeholder {
  display: grid;
  place-items: center;
  background: #293241;
  color: #edf3ff;
  font-weight: 900;
}

.contact-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.contact-info p {
  margin: 0;
}

.contact-name {
  color: #f3f6fb;
  font-weight: 700;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contact-name-row {
  display: flex;
  align-items: center;
  gap: 0.38rem;
  max-width: 100%;
}

.role-badge {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.08rem 0.45rem;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.2;
  flex-shrink: 0;
}

.role-badge.admin {
  color: #ffe6ae;
  background: rgba(181, 112, 18, 0.22);
  border-color: rgba(237, 166, 66, 0.55);
}

.role-badge.client {
  color: #c9efff;
  background: rgba(28, 109, 161, 0.24);
  border-color: rgba(92, 190, 255, 0.55);
}

.role-badge.trader {
  color: #c6ffd9;
  background: rgba(19, 130, 66, 0.24);
  border-color: rgba(74, 228, 130, 0.55);
}

.role-badge.user {
  color: #e2e6ef;
  background: rgba(113, 125, 147, 0.2);
  border-color: rgba(162, 176, 201, 0.42);
}

.contact-presence {
  margin-top: 0.14rem;
  color: #9aa8bc;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.contact-presence.online {
  color: #9ddeb6;
}

.contact-presence.typing {
  color: #ffd79d;
}

.presence-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #7d8799;
}

.online .presence-dot {
  background: #3ef378;
  box-shadow: 0 0 0 2px rgba(62, 243, 120, 0.18);
}

.contact-last {
  margin-top: 0.18rem;
  color: #b4bfd0;
  font-size: 0.76rem;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.6rem;
  display: grid;
  gap: 0.5rem;
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
  gap: 0.55rem;
}

.thread-user-name-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.thread-user-name-row h2 {
  margin: 0;
}

.thread-avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid rgba(148, 163, 188, 0.45);
}

.thread-avatar.placeholder {
  display: grid;
  place-items: center;
  background: #293241;
  color: #edf3ff;
  font-weight: 900;
}

.thread-status {
  margin: 0.12rem 0 0;
  color: #9ba9bd;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.thread-status.online {
  color: #9ddeb6;
}

.thread-status.typing {
  color: #ffd79d;
}

.thread-actions {
  display: flex;
  gap: 0.45rem;
}

.call-btn {
  border: 1px solid rgba(93, 149, 255, 0.55);
  border-radius: 999px;
  background: #23415f;
  color: #f5f9ff;
  padding: 0.34rem 0.72rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.call-btn.icon {
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
}

.call-btn.icon svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.call-btn.video {
  background: #2e3e89;
}

.call-btn.end {
  background: #632d39;
  border-color: rgba(255, 119, 142, 0.48);
}

.message-list {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.message-row.call {
  justify-content: center;
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

.message-avatar-photo {
  object-fit: cover;
  border: 1px solid rgba(131, 236, 200, 0.35);
  background: #1e2430;
}

.message-bubble {
  max-width: min(92%, 500px);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 16px;
  background: #232a36;
  padding: 0.56rem 0.68rem;
  touch-action: pan-y;
  transition: transform 0.16s ease;
}

.message-bubble.mine {
  background: #2f63de;
  border-color: rgba(141, 170, 255, 0.78);
}

.call-log-bubble {
  border: 1px solid rgba(94, 114, 143, 0.38);
  border-radius: 12px;
  background: #202734;
  padding: 0.46rem 0.62rem;
  min-width: 190px;
  max-width: min(92%, 360px);
  text-align: center;
}

.call-log-title {
  margin: 0;
  color: #dbe8ff;
  font-size: 0.78rem;
  font-weight: 700;
}

.call-log-bubble span {
  margin-top: 0.2rem;
  display: block;
  color: #adc1de;
  font-size: 0.68rem;
}

.message-bubble p {
  margin: 0;
  color: #f4f7ff;
}

.message-image {
  margin-top: 0.35rem;
  width: min(100%, 220px);
  max-height: 240px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(140, 161, 195, 0.55);
  display: block;
}

.message-image-link {
  display: inline-block;
  line-height: 0;
}

.reply-quote {
  border-left: 2px solid rgba(181, 201, 255, 0.62);
  background: rgba(21, 30, 45, 0.5);
  border-radius: 8px;
  padding: 0.28rem 0.42rem;
  margin-bottom: 0.3rem;
}

.reply-quote small {
  color: #c7d8ff;
  font-weight: 700;
}

.reply-quote p {
  margin: 0.12rem 0 0;
  font-size: 0.76rem;
  color: #d8e3f7;
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

.message-bubble.swiping {
  transition: none;
}

.composer {
  margin-top: 0.45rem;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.45rem;
}

.reply-preview {
  grid-column: 1 / -1;
  border: 1px solid rgba(98, 114, 142, 0.4);
  border-radius: 10px;
  background: #202734;
  padding: 0.42rem 0.55rem;
}

.image-preview {
  grid-column: 1 / -1;
  border: 1px solid rgba(98, 114, 142, 0.4);
  border-radius: 10px;
  background: #202734;
  padding: 0.42rem;
}

.image-preview img {
  width: min(100%, 220px);
  max-height: 180px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  border: 1px solid rgba(111, 132, 170, 0.52);
}

.image-preview button {
  margin-top: 0.32rem;
  border: 0;
  background: transparent;
  color: #90adff;
  padding: 0;
  font-size: 0.72rem;
  cursor: pointer;
}

.hidden-file-input {
  display: none;
}

.icon-action-btn {
  border: 1px solid rgba(92, 103, 124, 0.45);
  border-radius: 999px;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  padding: 0;
  color: #ecf2ff;
  font-weight: 700;
  cursor: pointer;
}

.icon-action-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.attach-btn {
  background: transparent;
  border-color: transparent;
}

.send-btn {
  background: #2c5cff;
  border-color: rgba(130, 160, 255, 0.62);
}

.icon-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.reply-preview p,
.reply-preview small {
  margin: 0;
  display: block;
}

.reply-preview p {
  color: #dce7ff;
  font-size: 0.76rem;
  font-weight: 700;
}

.reply-preview small {
  margin-top: 0.16rem;
  color: #b9c8e3;
  font-size: 0.72rem;
}

.reply-preview button {
  margin-top: 0.24rem;
  border: 0;
  background: transparent;
  color: #90adff;
  padding: 0;
  font-size: 0.72rem;
  cursor: pointer;
}

.composer input {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: #101721;
  color: #edf2fb;
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

.composer .attach-btn {
  background: transparent;
  border-color: transparent;
}

.composer .send-btn {
  background: #2c5cff;
  border-color: rgba(130, 160, 255, 0.62);
}

.muted {
  color: #9eacbd;
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

  .thread-actions {
    flex-wrap: wrap;
  }
}
</style>
