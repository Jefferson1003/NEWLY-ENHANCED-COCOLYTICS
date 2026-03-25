import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'COCOLYTICS';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: SMTP_USER && SMTP_PASS
    ? {
        user: SMTP_USER,
        pass: SMTP_PASS,
      }
    : undefined,
});

function buildOtpMailContent({ purpose, otp, expiresMinutes }) {
  const action = purpose === 'verify_email' ? 'Email Verification' : 'Password Reset';
  const plain = [
    `COCOLYTICS ${action}`,
    '',
    `Your OTP code is: ${otp}`,
    `This code expires in ${expiresMinutes} minutes.`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0b2f3b;">
      <h2 style="margin: 0 0 12px;">COCOLYTICS ${action}</h2>
      <p style="margin: 0 0 10px;">Use this OTP code:</p>
      <p style="margin: 0 0 10px; font-size: 24px; letter-spacing: 3px; font-weight: bold;">${otp}</p>
      <p style="margin: 0 0 10px;">This code expires in ${expiresMinutes} minutes.</p>
      <p style="margin: 0;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return { plain, html };
}

export async function sendOtpEmail({ to, purpose, otp, expiresMinutes = 10 }) {
  if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
    throw new Error('SMTP credentials are not configured.');
  }

  const subject = purpose === 'verify_email'
    ? 'COCOLYTICS Email Verification OTP'
    : 'COCOLYTICS Forgot Password OTP';

  const { plain, html } = buildOtpMailContent({ purpose, otp, expiresMinutes });

  await transporter.sendMail({
    from: `\"${SMTP_FROM_NAME}\" <${SMTP_FROM_EMAIL}>`,
    to,
    subject,
    text: plain,
    html,
  });
}
