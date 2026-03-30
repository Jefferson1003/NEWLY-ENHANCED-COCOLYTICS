import { pool } from '../db.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function createClientUser(fullName, email, passwordHash, staffReason = '') {
  const [result] = await pool.execute(
    `
      INSERT INTO users (full_name, email, password_hash, role, status, staff_reason, is_email_verified, email_verified_at)
      VALUES (?, ?, ?, 'client', 'pending_client', ?, 0, NULL)
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
      SELECT id, full_name, email, password_hash, role, status, is_email_verified, email_verified_at, is_archived, archived_at, created_at
      FROM users
      WHERE email IN (?, ?)
      LIMIT 1
    `,
    [rawEmail, correctedEmail]
  );

  return rows[0] || null;
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role,
        status,
        is_email_verified,
        email_verified_at,
        is_archived,
        archived_at,
        created_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [normalizedEmail]
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
        is_email_verified,
        email_verified_at,
        profile_name,
        profile_description,
        contact_number,
        business_address,
        staff_reason,
        profile_image_path,
        gcash_qr_path,
        is_archived,
        archived_at,
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

export async function markUserEmailVerifiedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_email_verified = 1, email_verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function updateUserPasswordHashById(id, passwordHash) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, id]
  );

  return result.affectedRows;
}

export async function createOtpCode({ userId, email, purpose, otpHash, expiresAt }) {
  const normalizedEmail = normalizeEmail(email);

  await pool.execute(
    `
      UPDATE user_otp_codes
      SET used_at = CURRENT_TIMESTAMP
      WHERE email = ?
        AND purpose = ?
        AND used_at IS NULL
    `,
    [normalizedEmail, purpose]
  );

  const [result] = await pool.execute(
    `
      INSERT INTO user_otp_codes (user_id, email, purpose, otp_hash, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [userId, normalizedEmail, purpose, otpHash, expiresAt]
  );

  return result.insertId;
}

export async function findLatestActiveOtpCode(email, purpose) {
  const normalizedEmail = normalizeEmail(email);
  const [rows] = await pool.execute(
    `
      SELECT id, user_id, email, purpose, otp_hash, expires_at, verified_at, used_at, created_at
      FROM user_otp_codes
      WHERE email = ?
        AND purpose = ?
        AND used_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
    [normalizedEmail, purpose]
  );

  return rows[0] || null;
}

export async function findOtpCodeById(id) {
  const [rows] = await pool.execute(
    `
      SELECT id, user_id, email, purpose, otp_hash, expires_at, verified_at, used_at, created_at
      FROM user_otp_codes
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function markOtpCodeVerifiedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE user_otp_codes
      SET verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function markOtpCodeUsedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE user_otp_codes
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function findAllNonAdminUsers() {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, role, status, profile_name, contact_number, staff_reason, is_archived, archived_at, created_at
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
      WHERE id = ? AND role = 'client' AND status = 'pending_client' AND is_archived = 0
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
      WHERE id = ? AND role = 'client' AND status = 'pending_staff' AND is_archived = 0
    `,
    [id]
  );

  return result.affectedRows;
}

export async function acceptAllPendingStaff() {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET role = 'trader', status = 'trader'
      WHERE role = 'client' AND status = 'pending_staff' AND is_archived = 0
    `
  );

  return result.affectedRows;
}

export async function archiveUserById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_archived = 1, archived_at = NOW()
      WHERE id = ? AND role != 'admin' AND is_archived = 0
    `,
    [id]
  );

  return result.affectedRows;
}

export async function restoreArchivedUserById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_archived = 0, archived_at = NULL
      WHERE id = ? AND role != 'admin' AND is_archived = 1
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

export async function updateTraderGcashQrById(id, gcashQrPath) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET gcash_qr_path = ?
      WHERE id = ? AND role = 'trader'
    `,
    [gcashQrPath, id]
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
    isEmailVerified: Boolean(user.is_email_verified),
    emailVerifiedAt: user.email_verified_at || null,
    profileName: user.full_name || user.profile_name || '',
    profileDescription: user.profile_description || '',
    contactNumber: user.contact_number || '',
    businessAddress: user.business_address || '',
    staffReason: user.staff_reason || '',
    profileImagePath: user.profile_image_path || '',
    gcashQrPath: user.gcash_qr_path || '',
    isArchived: Boolean(user.is_archived),
    archivedAt: user.archived_at || null,
    lastSeenAt: user.last_seen_at || null,
    createdAt: user.created_at,
  };
}
