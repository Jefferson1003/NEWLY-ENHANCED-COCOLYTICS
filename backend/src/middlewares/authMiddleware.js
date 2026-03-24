import jwt from 'jsonwebtoken';
import { findUserById } from '../models/userModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

export function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export function authRequired(req, res, next) {
  const rawHeader = req.headers.authorization || '';
  const headerToken = rawHeader.startsWith('Bearer ') ? rawHeader.slice(7) : '';
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(roles) {
  return async (req, res, next) => {
    if (roles.includes(req.auth.role)) {
      return next();
    }

    try {
      const currentUser = await findUserById(req.auth.id);
      if (!currentUser) {
        return res.status(401).json({ error: 'User not found for this session.' });
      }

      const currentRole = currentUser.role;
      if (roles.includes(currentRole)) {
        req.auth.role = currentRole;
        return next();
      }

      return res.status(403).json({ error: 'You do not have access to this resource.' });
    } catch {
      return res.status(500).json({ error: 'Could not verify permissions.' });
    }
  };
}
