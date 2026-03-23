import {
  acceptPendingClientById,
  acceptPendingStaffById,
  findAllNonAdminUsers,
  sanitizeUser,
} from '../models/userModel.js';

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
