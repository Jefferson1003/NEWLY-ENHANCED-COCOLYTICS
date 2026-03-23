import { acceptClientAsTrader, findUserById } from '../models/userModel.js';

export async function acceptTrader(req, res) {
  try {
    const user = await findUserById(req.auth.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.status === 'pending_client') {
      return res.status(400).json({ error: 'Admin must accept your client account first.' });
    }

    if (user.status === 'trader' || user.role === 'trader') {
      return res.status(200).json({ message: 'You are already a trader.' });
    }

    if (user.status !== 'accepted_client') {
      return res.status(400).json({ error: 'Your account must be accepted by admin first.' });
    }

    const affectedRows = await acceptClientAsTrader(req.auth.id);
    if (!affectedRows) {
      return res.status(400).json({ error: 'Could not upgrade account to trader.' });
    }

    return res.status(200).json({ message: 'You are now a trader.' });
  } catch {
    return res.status(500).json({ error: 'Could not update trader status.' });
  }
}
