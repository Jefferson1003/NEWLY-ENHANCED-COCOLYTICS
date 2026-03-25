import { pool } from '../db.js';
import { getOrCreateConversationId } from './chatModel.js';

function normalizeCallMode(mode) {
  return String(mode || '').toLowerCase() === 'video' ? 'video' : 'audio';
}

export async function createOutgoingCallLog(callerId, calleeId, callMode = 'audio') {
  const conversationId = await getOrCreateConversationId(callerId, calleeId);
  const normalizedMode = normalizeCallMode(callMode);

  const [result] = await pool.execute(
    `
      INSERT INTO chat_call_logs (
        conversation_id,
        caller_id,
        callee_id,
        call_mode,
        status
      )
      VALUES (?, ?, ?, ?, 'ringing')
    `,
    [conversationId, callerId, calleeId, normalizedMode]
  );

  return result.insertId;
}

export async function markCallAccepted(callId) {
  const [result] = await pool.execute(
    `
      UPDATE chat_call_logs
      SET
        answered_at = COALESCE(answered_at, CURRENT_TIMESTAMP)
      WHERE id = ? AND status = 'ringing'
    `,
    [callId]
  );

  return result.affectedRows;
}

export async function markCallDeclined(callId) {
  const [result] = await pool.execute(
    `
      UPDATE chat_call_logs
      SET
        status = 'declined',
        ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
        duration_seconds = 0
      WHERE id = ? AND status = 'ringing'
    `,
    [callId]
  );

  return result.affectedRows;
}

export async function markCallEnded(callId) {
  const [rows] = await pool.execute(
    `
      SELECT id, status, started_at, answered_at, ended_at
      FROM chat_call_logs
      WHERE id = ?
      LIMIT 1
    `,
    [callId]
  );

  const call = rows[0] || null;
  if (!call) {
    return 0;
  }

  if (call.ended_at) {
    return 0;
  }

  const currentStatus = String(call.status || '').toLowerCase();
  if (!['ringing', 'completed', 'missed', 'declined', 'cancelled'].includes(currentStatus)) {
    return 0;
  }

  const isAnswered = Boolean(call.answered_at);
  const [result] = await pool.execute(
    `
      UPDATE chat_call_logs
      SET
        status = ?,
        ended_at = CURRENT_TIMESTAMP,
        duration_seconds = CASE
          WHEN ? THEN GREATEST(TIMESTAMPDIFF(SECOND, COALESCE(answered_at, started_at), CURRENT_TIMESTAMP), 0)
          ELSE 0
        END
      WHERE id = ? AND ended_at IS NULL
    `,
    [isAnswered ? 'completed' : 'missed', isAnswered ? 1 : 0, callId]
  );

  return result.affectedRows;
}

export async function listCallLogsBetweenTraders(firstTraderId, secondTraderId, limit = 80) {
  const conversationId = await getOrCreateConversationId(firstTraderId, secondTraderId);
  const parsedLimit = Number(limit);
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 200)
    : 80;

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        conversation_id,
        caller_id,
        callee_id,
        call_mode,
        status,
        started_at,
        answered_at,
        ended_at,
        duration_seconds,
        created_at
      FROM chat_call_logs
      WHERE conversation_id = ?
      ORDER BY id DESC
      LIMIT ${safeLimit}
    `,
    [conversationId]
  );

  return rows.reverse();
}
