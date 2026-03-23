import bcrypt from 'bcryptjs';
import { createToken } from '../middlewares/authMiddleware.js';
import { createClientUser, findUserById, findUserForLogin, sanitizeUser } from '../models/userModel.js';

export async function register(req, res) {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'fullName, email, and password are required.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await createClientUser(fullName, email, passwordHash);

    return res.status(201).json({
      message: 'Register application sent successfully, please wait for the admin approval.',
      status: 'pending_client',
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists.' });
    }

    return res.status(500).json({ error: 'Could not register user.' });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  try {
    const user = await findUserForLogin(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    return res.status(200).json({
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch {
    return res.status(500).json({ error: 'Could not log in.' });
  }
}

export async function me(req, res) {
  try {
    const user = await findUserById(req.auth.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch user profile.' });
  }
}
