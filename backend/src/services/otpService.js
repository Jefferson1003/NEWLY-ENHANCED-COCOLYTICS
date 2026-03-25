const OTP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_OTP_LENGTH = 8;

export function generateAlphaNumericOtp(length = DEFAULT_OTP_LENGTH) {
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * OTP_ALPHABET.length);
    otp += OTP_ALPHABET[randomIndex];
  }
  return otp;
}

export function buildOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isOtpExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}
