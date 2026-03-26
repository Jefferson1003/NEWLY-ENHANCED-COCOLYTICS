import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createToken } from '../middlewares/authMiddleware.js';
import {
  createClientUser,
  createOtpCode,
  findLatestActiveOtpCode,
  findOtpCodeById,
  findUserByEmail,
  findUserById,
  findUserForLogin,
  markOtpCodeUsedById,
  markOtpCodeVerifiedById,
  markUserEmailVerifiedById,
  sanitizeUser,
  updateUserPasswordHashById,
} from '../models/userModel.js';
import { sendOtpEmail } from '../services/emailService.js';
import { buildOtpExpiry, generateAlphaNumericOtp, isOtpExpired } from '../services/otpService.js';

const OTP_EXPIRY_MINUTES = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

function passwordIsStrong(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(value || ''));
}

function createPasswordResetToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function verifyPasswordResetToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function issueOtpForUser({ user, purpose }) {
  const otpCode = generateAlphaNumericOtp();
  const otpHash = await bcrypt.hash(otpCode, 10);
  const expiresAt = buildOtpExpiry(OTP_EXPIRY_MINUTES);

  await createOtpCode({
    userId: user.id,
    email: user.email,
    purpose,
    otpHash,
    expiresAt,
  });

  await sendOtpEmail({
    to: user.email,
    purpose,
    otp: otpCode,
    expiresMinutes: OTP_EXPIRY_MINUTES,
  });
}

export async function register(req, res) {
  const { fullName, email, password, staffReason } = req.body;

  if (!fullName || !email || !password || !String(staffReason || '').trim()) {
    return res.status(400).json({ error: 'fullName, email, password, and staffReason are required.' });
  }

  if (!passwordIsStrong(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await createClientUser(fullName, email, passwordHash, staffReason);
    const createdUser = await findUserByEmail(email);

    if (!createdUser) {
      return res.status(500).json({ error: 'Could not register user.' });
    }

    await issueOtpForUser({ user: createdUser, purpose: 'verify_email' });

    return res.status(201).json({
      message: 'Registration successful. Verify your email with the OTP sent to your inbox.',
      status: 'pending_client',
      email: createdUser.email,
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

    if (user.is_archived) {
      return res.status(403).json({
        error: 'Your account has been removed. Please contact the administrator.',
        code: 'ACCOUNT_ARCHIVED',
      });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({
        error: 'Email is not verified. Please verify your email first.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
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

export async function resendVerifyOtp(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email is required.' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User with this email was not found.' });
    }

    if (user.is_email_verified) {
      return res.status(200).json({ message: 'Email is already verified.' });
    }

    await issueOtpForUser({ user, purpose: 'verify_email' });
    return res.status(200).json({ message: 'Verification OTP sent to your email.' });
  } catch {
    return res.status(500).json({ error: 'Could not send verification OTP.' });
  }
}

export async function verifyEmailOtp(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'email and otp are required.' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User with this email was not found.' });
    }

    const otpRecord = await findLatestActiveOtpCode(email, 'verify_email');
    if (!otpRecord) {
      return res.status(400).json({ error: 'No active verification OTP found. Please resend OTP.' });
    }

    if (isOtpExpired(otpRecord.expires_at)) {
      await markOtpCodeUsedById(otpRecord.id);
      return res.status(400).json({ error: 'OTP has expired. Please resend OTP.' });
    }

    const otpMatches = await bcrypt.compare(String(otp).trim().toUpperCase(), otpRecord.otp_hash);
    if (!otpMatches) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    await markOtpCodeVerifiedById(otpRecord.id);
    await markOtpCodeUsedById(otpRecord.id);
    await markUserEmailVerifiedById(user.id);

    const verifiedUser = await findUserById(user.id);
    return res.status(200).json({
      message: 'Email verified successfully.',
      token: createToken(verifiedUser),
      user: sanitizeUser(verifiedUser),
    });
  } catch {
    return res.status(500).json({ error: 'Could not verify OTP.' });
  }
}

export async function forgotPasswordRequestOtp(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email is required.' });
  }

  try {
    const user = await findUserByEmail(email);

    if (user) {
      await issueOtpForUser({ user, purpose: 'reset_password' });
    }

    return res.status(200).json({ message: 'If your email exists, an OTP has been sent.' });
  } catch {
    return res.status(500).json({ error: 'Could not process forgot password request.' });
  }
}

export async function forgotPasswordVerifyOtp(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'email and otp are required.' });
  }

  try {
    const otpRecord = await findLatestActiveOtpCode(email, 'reset_password');
    if (!otpRecord) {
      return res.status(400).json({ error: 'No active reset OTP found. Please request a new OTP.' });
    }

    if (isOtpExpired(otpRecord.expires_at)) {
      await markOtpCodeUsedById(otpRecord.id);
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    const otpMatches = await bcrypt.compare(String(otp).trim().toUpperCase(), otpRecord.otp_hash);
    if (!otpMatches) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    await markOtpCodeVerifiedById(otpRecord.id);
    const resetToken = createPasswordResetToken({
      otpId: otpRecord.id,
      email: otpRecord.email,
      purpose: 'reset_password',
    });

    return res.status(200).json({
      message: 'OTP verified successfully.',
      resetToken,
    });
  } catch {
    return res.status(500).json({ error: 'Could not verify reset OTP.' });
  }
}

export async function forgotPasswordReset(req, res) {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'resetToken, newPassword, and confirmPassword are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Password and confirm password do not match.' });
  }

  if (!passwordIsStrong(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.' });
  }

  try {
    const payload = verifyPasswordResetToken(resetToken);
    if (!payload || payload.purpose !== 'reset_password') {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    const otpRecord = await findOtpCodeById(payload.otpId);
    if (!otpRecord || otpRecord.email !== payload.email || otpRecord.purpose !== 'reset_password') {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    if (otpRecord.used_at || !otpRecord.verified_at || isOtpExpired(otpRecord.expires_at)) {
      return res.status(400).json({ error: 'Reset token is expired or already used.' });
    }

    const user = await findUserById(otpRecord.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordHashById(user.id, passwordHash);
    await markOtpCodeUsedById(otpRecord.id);

    return res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch {
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
}
