import { pool } from '../db.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function createClientUser(fullName, email, passwordHash) {
  const [result] = await pool.execute(
    `
      INSERT INTO users (full_name, email, password_hash, role, status)
      VALUES (?, ?, ?, 'client', 'pending_client')
    `,
    [String(fullName).trim(), normalizeEmail(email), passwordHash]
  );

  return result.insertId;
}

export async function findUserForLogin(email) {
  const rawEmail = normalizeEmail(email);
  const correctedEmail = rawEmail.replace(',', '.');

  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, password_hash, role, status, created_at
      FROM users
      WHERE email IN (?, ?)
      LIMIT 1
    `,
    [rawEmail, correctedEmail]
  );

  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, password_hash, role, status, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function findAllNonAdminUsers() {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      WHERE role != 'admin'
      ORDER BY created_at DESC
    `
  );

  return rows;
}

export async function acceptPendingClientById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET status = 'accepted_client'
      WHERE id = ? AND role = 'client' AND status = 'pending_client'
    `,
    [id]
  );

  return result.affectedRows;
}

export async function acceptPendingStaffById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET role = 'trader', status = 'trader'
      WHERE id = ? AND role = 'client' AND status = 'pending_staff'
    `,
    [id]
  );

  return result.affectedRows;
}

export async function setPendingStaffRequest(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET status = 'pending_staff'
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function acceptClientAsTrader(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET role = 'trader', status = 'trader'
      WHERE id = ? AND role = 'client' AND status = 'accepted_client'
    `,
    [id]
  );

  return result.affectedRows;
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
  };
}
