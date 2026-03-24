import { pool } from '../db.js';

export async function createPaperUpload(payload) {
  const [result] = await pool.execute(
    `
      INSERT INTO paper_uploads (
        trader_id,
        paper_type,
        title,
        description,
        file_path,
        original_file_name,
        mime_type,
        file_size
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.traderId,
      payload.paperType,
      String(payload.title || '').trim(),
      String(payload.description || '').trim() || null,
      payload.filePath,
      payload.originalFileName,
      payload.mimeType || null,
      payload.fileSize || null,
    ]
  );

  return result.insertId;
}

export async function findPaperUploadsByTraderId(traderId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        trader_id,
        paper_type,
        title,
        description,
        file_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      FROM paper_uploads
      WHERE trader_id = ?
      ORDER BY created_at DESC
    `,
    [traderId]
  );

  return rows;
}

export async function findAllPaperUploads() {
  const [rows] = await pool.execute(
    `
      SELECT
        pu.id,
        pu.trader_id,
        pu.paper_type,
        pu.title,
        pu.description,
        pu.file_path,
        pu.original_file_name,
        pu.mime_type,
        pu.file_size,
        pu.status,
        pu.review_notes,
        pu.reviewed_by,
        pu.reviewed_at,
        pu.created_at,
        pu.updated_at,
        u.full_name AS trader_name,
        u.email AS trader_email,
        reviewer.full_name AS reviewer_name
      FROM paper_uploads pu
      INNER JOIN users u ON u.id = pu.trader_id
      LEFT JOIN users reviewer ON reviewer.id = pu.reviewed_by
      ORDER BY
        CASE pu.status
          WHEN 'pending' THEN 0
          WHEN 'rejected' THEN 1
          WHEN 'approved' THEN 2
          ELSE 3
        END,
        pu.created_at DESC
    `
  );

  return rows;
}

export async function findPaperUploadById(uploadId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        trader_id,
        paper_type,
        title,
        description,
        file_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      FROM paper_uploads
      WHERE id = ?
      LIMIT 1
    `,
    [uploadId]
  );

  return rows[0] || null;
}

export async function updatePaperUploadStatus(uploadId, payload) {
  const [result] = await pool.execute(
    `
      UPDATE paper_uploads
      SET
        status = ?,
        review_notes = ?,
        reviewed_by = ?,
        reviewed_at = NOW()
      WHERE id = ?
    `,
    [
      payload.status,
      String(payload.reviewNotes || '').trim() || null,
      payload.reviewedBy,
      uploadId,
    ]
  );

  return result.affectedRows;
}

export function sanitizePaperUpload(row) {
  return {
    id: row.id,
    traderId: row.trader_id,
    traderName: row.trader_name || '',
    traderEmail: row.trader_email || '',
    paperType: row.paper_type,
    title: row.title,
    description: row.description || '',
    filePath: row.file_path,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type || '',
    fileSize: Number(row.file_size || 0),
    status: row.status,
    reviewNotes: row.review_notes || '',
    reviewedBy: row.reviewed_by || null,
    reviewerName: row.reviewer_name || '',
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
