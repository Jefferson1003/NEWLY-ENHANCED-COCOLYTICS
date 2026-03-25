import { pool } from '../db.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function createClientUser(fullName, email, passwordHash, staffReason = '') {
  const [result] = await pool.execute(
    `
      INSERT INTO users (full_name, email, password_hash, role, status, staff_reason)
      VALUES (?, ?, ?, 'client', 'pending_client', ?)
    `,
    [
      String(fullName).trim(),
      normalizeEmail(email),
      passwordHash,
      String(staffReason || '').trim() || null,
    ]
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
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role,
        status,
        profile_name,
        profile_description,
        contact_number,
        business_address,
        staff_reason,
        profile_image_path,
        last_seen_at,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function updateUserLastSeenById(id, seenAt = new Date()) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET last_seen_at = ?
      WHERE id = ?
    `,
    [seenAt, id]
  );

  return result.affectedRows;
}

export async function findAllNonAdminUsers() {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, role, status, profile_name, contact_number, staff_reason, created_at
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

export async function updateTraderProfileById(id, payload) {
  const normalizedName = String(payload.name || '').trim();
  const [result] = await pool.execute(
    `
      UPDATE users
      SET
        full_name = ?,
        profile_name = ?,
        profile_description = ?,
        contact_number = ?,
        business_address = ?
      WHERE id = ? AND role = 'trader'
    `,
    [
      normalizedName,
      normalizedName,
      String(payload.description || '').trim(),
      String(payload.contactNumber || '').trim(),
      String(payload.businessAddress || '').trim(),
      id,
    ]
  );

  return result.affectedRows;
}

export async function updateTraderProfileImageById(id, profileImagePath) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET profile_image_path = ?
      WHERE id = ? AND role = 'trader'
    `,
    [profileImagePath, id]
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
    profileName: user.full_name || user.profile_name || '',
    profileDescription: user.profile_description || '',
    contactNumber: user.contact_number || '',
    businessAddress: user.business_address || '',
    staffReason: user.staff_reason || '',
    profileImagePath: user.profile_image_path || '',
    lastSeenAt: user.last_seen_at || null,
    createdAt: user.created_at,
  };
}
