import {
  acceptPendingClientById,
  acceptPendingStaffById,
  findAllNonAdminUsers,
  sanitizeUser,
} from '../models/userModel.js';
import {
  findAllPaperUploads,
  findPaperUploadById,
  sanitizePaperUpload,
  updatePaperUploadStatus,
} from '../models/paperUploadModel.js';

export async function listClients(_req, res) {
  try {
    const clients = await findAllNonAdminUsers();
    return res.status(200).json({ clients: clients.map(sanitizeUser) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch clients.' });
  }
}

export async function acceptClient(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await acceptPendingClientById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Pending client not found.' });
    }

    return res.status(200).json({ message: 'Client accepted successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not update client status.' });
  }
}

export async function acceptStaff(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await acceptPendingStaffById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Pending staff request not found.' });
    }

    return res.status(200).json({ message: 'Client promoted to staff.' });
  } catch {
    return res.status(500).json({ error: 'Could not approve staff request.' });
  }
}

export async function listPaperUploads(_req, res) {
  try {
    const rows = await findAllPaperUploads();
    return res.status(200).json({ uploads: rows.map(sanitizePaperUpload) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch paper uploads.' });
  }
}

export async function reviewPaperUpload(req, res) {
  const uploadId = Number(req.params.id);
  const status = String(req.body?.status || '').trim().toLowerCase();
  const reviewNotes = String(req.body?.reviewNotes || '').trim();

  if (!Number.isInteger(uploadId) || uploadId <= 0) {
    return res.status(400).json({ error: 'Invalid upload ID.' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected.' });
  }

  try {
    const existing = await findPaperUploadById(uploadId);
    if (!existing) {
      return res.status(404).json({ error: 'Paper upload not found.' });
    }

    const affectedRows = await updatePaperUploadStatus(uploadId, {
      status,
      reviewNotes,
      reviewedBy: req.auth.id,
    });

    if (!affectedRows) {
      return res.status(404).json({ error: 'Paper upload not found.' });
    }

    return res.status(200).json({
      message: `Paper upload ${status} successfully.`,
    });
  } catch {
    return res.status(500).json({ error: 'Could not update paper upload status.' });
  }
}
