import { pool } from '../db.js';

function normalizePair(firstTraderId, secondTraderId) {
  const a = Number(firstTraderId);
  const b = Number(secondTraderId);
  return a < b ? [a, b] : [b, a];
}

export async function findConversationIdBetweenTraders(firstTraderId, secondTraderId) {
  const [traderOneId, traderTwoId] = normalizePair(firstTraderId, secondTraderId);

  const [rows] = await pool.execute(
    `
      SELECT id
      FROM chat_conversations
      WHERE trader_one_id = ? AND trader_two_id = ?
      LIMIT 1
    `,
    [traderOneId, traderTwoId]
  );

  return rows[0]?.id || null;
}

export async function getOrCreateConversationId(firstTraderId, secondTraderId) {
  const [traderOneId, traderTwoId] = normalizePair(firstTraderId, secondTraderId);
  const existingConversationId = await findConversationIdBetweenTraders(traderOneId, traderTwoId);
  if (existingConversationId) {
    return existingConversationId;
  }

  try {
    const [result] = await pool.execute(
      `
        INSERT INTO chat_conversations (trader_one_id, trader_two_id)
        VALUES (?, ?)
      `,
      [traderOneId, traderTwoId]
    );

    return result.insertId;
  } catch {
    const [rows] = await pool.execute(
      `
        SELECT id
        FROM chat_conversations
        WHERE trader_one_id = ? AND trader_two_id = ?
        LIMIT 1
      `,
      [traderOneId, traderTwoId]
    );

    return rows[0]?.id || null;
  }
}

export async function listTraderMessageContacts(traderId) {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id AS trader_id,
        COALESCE(NULLIF(u.profile_name, ''), u.full_name) AS trader_name,
        u.profile_image_path,
        c.id AS conversation_id,
        lm.message_text AS last_message,
        lm.sender_id AS last_sender_id,
        lm.created_at AS last_message_at,
        COALESCE(um.unread_count, 0) AS unread_count
      FROM users u
      LEFT JOIN chat_conversations c
        ON c.trader_one_id = LEAST(u.id, ?)
       AND c.trader_two_id = GREATEST(u.id, ?)
      LEFT JOIN (
        SELECT m1.conversation_id, m1.message_text, m1.sender_id, m1.created_at
        FROM chat_messages m1
        INNER JOIN (
          SELECT conversation_id, MAX(id) AS max_id
          FROM chat_messages
          GROUP BY conversation_id
        ) latest ON latest.max_id = m1.id
      ) lm ON lm.conversation_id = c.id
      LEFT JOIN (
        SELECT conversation_id, COUNT(*) AS unread_count
        FROM chat_messages
        WHERE receiver_id = ? AND is_read = 0
        GROUP BY conversation_id
      ) um ON um.conversation_id = c.id
      WHERE u.role = 'trader' AND u.id != ?
      ORDER BY
        CASE WHEN lm.created_at IS NULL THEN 1 ELSE 0 END,
        lm.created_at DESC,
        trader_name ASC
    `,
    [traderId, traderId, traderId, traderId]
  );

  return rows;
}

export async function listMessagesBetweenTraders(currentTraderId, otherTraderId, limit = 80) {
  const currentId = Number(currentTraderId);
  const otherId = Number(otherTraderId);
  const conversationId = await findConversationIdBetweenTraders(currentId, otherId);

  const parsedLimit = Number(limit);
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 200)
    : 80;

  let rows = [];
  if (conversationId) {
    const [conversationRows] = await pool.execute(
      `
        SELECT
          id,
          conversation_id,
          sender_id,
          receiver_id,
          message_text,
          is_read,
          created_at
        FROM chat_messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT ${safeLimit}
      `,
      [conversationId]
    );
    rows = conversationRows;
  } else {
    const [pairRows] = await pool.execute(
      `
        SELECT
          id,
          conversation_id,
          sender_id,
          receiver_id,
          message_text,
          is_read,
          created_at
        FROM chat_messages
        WHERE
          (sender_id = ? AND receiver_id = ?)
          OR
          (sender_id = ? AND receiver_id = ?)
        ORDER BY id DESC
        LIMIT ${safeLimit}
      `,
      [currentId, otherId, otherId, currentId]
    );
    rows = pairRows;
  }

  if (conversationId) {
    await pool.execute(
      `
        UPDATE chat_messages
        SET is_read = 1
        WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0
      `,
      [conversationId, currentId]
    );
  } else {
    await pool.execute(
      `
        UPDATE chat_messages
        SET is_read = 1
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `,
      [otherId, currentId]
    );
  }

  return rows.reverse();
}

export async function createMessageBetweenTraders(senderId, receiverId, messageText) {
  const conversationId = await getOrCreateConversationId(senderId, receiverId);

  const [result] = await pool.execute(
    `
      INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        receiver_id,
        message_text
      )
      VALUES (?, ?, ?, ?)
    `,
    [conversationId, senderId, receiverId, String(messageText || '').trim()]
  );

  await pool.execute(
    `
      UPDATE chat_conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [conversationId]
  );

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        conversation_id,
        sender_id,
        receiver_id,
        message_text,
        is_read,
        created_at
      FROM chat_messages
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}
