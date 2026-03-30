import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  createMessageBetweenTraders,
  listConversationPartnerIds,
  listMessagesBetweenTraders,
  listMessageContactsByRoles,
} from '../models/chatModel.js';
import {
  createOutgoingCallLog,
  listCallLogsBetweenTraders,
  markCallAccepted,
  markCallDeclined,
  markCallEnded,
} from '../models/callModel.js';
import {
  addTraderStreamClient,
  isTraderOnline,
  pushTraderEvent,
  removeTraderStreamClient,
} from '../realtime/messageStream.js';
import { findUserById, updateUserLastSeenById } from '../models/userModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const messengerUploadsDir = path.resolve(__dirname, '../../../frontend/public/uploads/messenger');
const PRESENCE_RECENT_WINDOW_MS = 90 * 1000;

const messageImageStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(messengerUploadsDir, { recursive: true });
      cb(null, messengerUploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExt = extension || '.jpg';
    const uniqueName = `msg-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

function fileFilter(_req, file, cb) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'));
    return;
  }

  cb(null, true);
}

export const uploadMessageImage = multer({
  storage: messageImageStorage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
}).single('messageImage');

function createChatHandlers(options) {
  const {
    allowedPartnerRoles,
    invalidPartnerLabel,
    roleName,
  } = options;

  async function listMessageContacts(req, res) {
    try {
      await updateUserLastSeenById(req.auth.id);
      const rows = await listMessageContactsByRoles(req.auth.id, allowedPartnerRoles);
      return res.status(200).json({
        contacts: rows.map((row) => ({
          traderId: row.partner_id,
          traderName: row.partner_name,
          partnerRole: row.partner_role,
          profileImagePath: row.profile_image_path || '',
          conversationId: row.conversation_id || null,
          lastMessage: row.last_message || '',
          lastSenderId: row.last_sender_id || null,
          lastMessageAt: row.last_message_at || null,
          unreadCount: Number(row.unread_count || 0),
          isOnline: Boolean(
            isTraderOnline(row.partner_id)
            || (row.last_seen_at && (Date.now() - new Date(row.last_seen_at).getTime()) <= PRESENCE_RECENT_WINDOW_MS)
          ),
          lastSeenAt: row.last_seen_at || null,
        })),
      });
    } catch {
      return res.status(200).json({ contacts: [] });
    }
  }

  async function broadcastPresenceUpdate(changedUserId) {
    const partnerIds = await listConversationPartnerIds(changedUserId);
    const uniquePartnerIds = Array.from(new Set(partnerIds));

    for (const partnerId of uniquePartnerIds) {
      pushTraderEvent(partnerId, 'chat-presence', {
        type: 'presence:update',
        traderId: Number(changedUserId),
      });
    }
  }

  function streamMessageEvents(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const currentUserId = Number(req.auth.id);
    addTraderStreamClient(currentUserId, res);

    updateUserLastSeenById(currentUserId);
    broadcastPresenceUpdate(currentUserId).catch(() => {});

    const keepAliveTimer = setInterval(() => {
      updateUserLastSeenById(currentUserId).catch(() => {});
      res.write('event: heartbeat\n');
      res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      removeTraderStreamClient(currentUserId, res);
      updateUserLastSeenById(currentUserId).catch(() => {});
      broadcastPresenceUpdate(currentUserId).catch(() => {});
    });
  }

  async function heartbeatMessagePresence(req, res) {
    try {
      await updateUserLastSeenById(req.auth.id);
      return res.status(200).json({ ok: true, ts: new Date().toISOString() });
    } catch {
      return res.status(500).json({ error: 'Could not update presence.' });
    }
  }

  async function listMessagesWithPartner(req, res) {
    const partnerId = Number(req.params.partnerId);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return res.status(400).json({ error: `Invalid ${invalidPartnerLabel} ID.` });
    }

    if (partnerId === req.auth.id) {
      return res.status(400).json({ error: 'You cannot message yourself.' });
    }

    try {
      await updateUserLastSeenById(req.auth.id);
      const partner = await findUserById(partnerId);
      if (!partner || !allowedPartnerRoles.includes(String(partner.role || '').toLowerCase()) || partner.is_archived) {
        return res.status(404).json({ error: `${invalidPartnerLabel} not found.` });
      }

      const rows = await listMessagesBetweenTraders(req.auth.id, partnerId);
      const callLogs = await listCallLogsBetweenTraders(req.auth.id, partnerId);

      return res.status(200).json({
        traderId: partnerId,
        messages: rows.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          messageText: row.message_text,
          messageImagePath: row.message_image_path || '',
          replyToMessageId: row.reply_to_message_id || null,
          replyToMessageText: row.reply_to_message_text || '',
          replyToSenderId: row.reply_to_sender_id || null,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
        callLogs: callLogs.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          callerId: row.caller_id,
          calleeId: row.callee_id,
          callMode: row.call_mode,
          status: row.status,
          startedAt: row.started_at,
          answeredAt: row.answered_at,
          endedAt: row.ended_at,
          durationSeconds: Number(row.duration_seconds || 0),
          createdAt: row.created_at,
        })),
      });
    } catch {
      return res.status(500).json({ error: 'Could not fetch messages.' });
    }
  }

  async function sendMessageToPartner(req, res) {
    const partnerId = Number(req.params.partnerId);
    const messageText = String(req.body?.messageText || '').trim();
    const messageImagePath = req.file ? `/uploads/messenger/${req.file.filename}` : '';
    const replyToMessageId = Number(req.body?.replyToMessageId);
    const safeReplyToMessageId = Number.isInteger(replyToMessageId) && replyToMessageId > 0
      ? replyToMessageId
      : null;

    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return res.status(400).json({ error: `Invalid ${invalidPartnerLabel} ID.` });
    }

    if (partnerId === req.auth.id) {
      return res.status(400).json({ error: 'You cannot message yourself.' });
    }

    if (!messageText && !messageImagePath) {
      return res.status(400).json({ error: 'messageText or messageImage is required.' });
    }

    if (messageText.length > 2000) {
      return res.status(400).json({ error: 'messageText must be 2000 characters or less.' });
    }

    try {
      await updateUserLastSeenById(req.auth.id);
      const partner = await findUserById(partnerId);
      if (!partner || !allowedPartnerRoles.includes(String(partner.role || '').toLowerCase()) || partner.is_archived) {
        return res.status(404).json({ error: `${invalidPartnerLabel} not found.` });
      }

      const row = await createMessageBetweenTraders(
        req.auth.id,
        partnerId,
        messageText,
        safeReplyToMessageId,
        messageImagePath
      );

      const messagePayload = {
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        messageText: row.message_text,
        messageImagePath: row.message_image_path || '',
        replyToMessageId: row.reply_to_message_id || null,
        replyToMessageText: row.reply_to_message_text || '',
        replyToSenderId: row.reply_to_sender_id || null,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      };

      pushTraderEvent(req.auth.id, 'chat-message', {
        type: 'message:new',
        partnerId,
        message: messagePayload,
      });

      pushTraderEvent(partnerId, 'chat-message', {
        type: 'message:new',
        partnerId: req.auth.id,
        message: messagePayload,
      });

      return res.status(201).json({ message: messagePayload });
    } catch (error) {
      if (error.message === 'replyToMessageId is invalid for this conversation.') {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Could not send message.' });
    }
  }

  async function sendCallSignalToPartner(req, res) {
    const partnerId = Number(req.params.partnerId);
    const signalType = String(req.body?.signalType || '').trim().toLowerCase();
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
    const callMode = String(payload?.mode || 'audio').toLowerCase() === 'video' ? 'video' : 'audio';
    const requestedCallId = Number(payload?.callId);
    const callId = Number.isInteger(requestedCallId) && requestedCallId > 0 ? requestedCallId : null;
    const allowedSignalTypes = new Set(['call:invite', 'call:accept', 'call:decline', 'call:offer', 'call:answer', 'call:ice', 'call:end']);

    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return res.status(400).json({ error: `Invalid ${invalidPartnerLabel} ID.` });
    }

    if (partnerId === req.auth.id) {
      return res.status(400).json({ error: 'You cannot call yourself.' });
    }

    if (!allowedSignalTypes.has(signalType)) {
      return res.status(400).json({ error: 'Invalid call signal type.' });
    }

    try {
      await updateUserLastSeenById(req.auth.id);
      const partner = await findUserById(partnerId);
      if (!partner || !allowedPartnerRoles.includes(String(partner.role || '').toLowerCase()) || partner.is_archived) {
        return res.status(404).json({ error: `${invalidPartnerLabel} not found.` });
      }

      let resolvedCallId = callId;
      if (signalType === 'call:invite') {
        resolvedCallId = await createOutgoingCallLog(req.auth.id, partnerId, callMode);
      } else if (signalType === 'call:accept' && resolvedCallId) {
        await markCallAccepted(resolvedCallId);
      } else if (signalType === 'call:decline' && resolvedCallId) {
        await markCallDeclined(resolvedCallId);
      } else if (signalType === 'call:end' && resolvedCallId) {
        await markCallEnded(resolvedCallId);
      }

      const eventPayload = {
        type: 'call:signal',
        signalType,
        fromTraderId: req.auth.id,
        toTraderId: partnerId,
        payload: {
          ...payload,
          mode: callMode,
          callId: resolvedCallId,
        },
        createdAt: new Date().toISOString(),
      };

      pushTraderEvent(partnerId, 'chat-call', eventPayload);
      pushTraderEvent(req.auth.id, 'chat-call', eventPayload);

      return res.status(200).json({
        ok: true,
        callId: resolvedCallId,
      });
    } catch {
      return res.status(500).json({ error: 'Could not send call signal.' });
    }
  }

  return {
    listMessageContacts,
    streamMessageEvents,
    heartbeatMessagePresence,
    listMessagesWithPartner,
    sendMessageToPartner,
    sendCallSignalToPartner,
    roleName,
  };
}

export const traderChatHandlers = createChatHandlers({
  allowedPartnerRoles: ['admin', 'client', 'trader'],
  invalidPartnerLabel: 'Trader',
  roleName: 'trader',
});

export const clientChatHandlers = createChatHandlers({
  allowedPartnerRoles: ['admin', 'client', 'trader'],
  invalidPartnerLabel: 'Admin',
  roleName: 'client',
});

export const adminChatHandlers = createChatHandlers({
  allowedPartnerRoles: ['admin', 'client', 'trader'],
  invalidPartnerLabel: 'User',
  roleName: 'admin',
});
