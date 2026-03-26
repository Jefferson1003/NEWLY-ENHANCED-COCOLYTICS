import {
  acceptAllPendingStaff,
  acceptPendingClientById,
  acceptPendingStaffById,
  archiveUserById,
  findAllNonAdminUsers,
  findUserById,
  restoreArchivedUserById,
  sanitizeUser,
} from '../models/userModel.js';
import {
  findAllPaperUploads,
  findPaperUploadsByTraderId,
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

export async function acceptAllStaff(req, res) {
  try {
    const updatedCount = await acceptAllPendingStaff();
    return res.status(200).json({
      message: updatedCount
        ? `Accepted ${updatedCount} staff application${updatedCount > 1 ? 's' : ''}.`
        : 'No pending staff applications found.',
      updatedCount,
    });
  } catch {
    return res.status(500).json({ error: 'Could not approve all staff requests.' });
  }
}

export async function getClientDetails(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const user = await findUserById(targetId);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ error: 'User not found.' });
    }

    const uploads = await findPaperUploadsByTraderId(targetId);

    return res.status(200).json({
      user: sanitizeUser(user),
      documents: uploads.map(sanitizePaperUpload),
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch user details.' });
  }
}

export async function archiveClient(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await archiveUserById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'User not found or already archived.' });
    }

    return res.status(200).json({ message: 'User archived successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not archive user.' });
  }
}

export async function restoreClient(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await restoreArchivedUserById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Archived user not found.' });
    }

    return res.status(200).json({ message: 'User restored successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not restore user.' });
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
