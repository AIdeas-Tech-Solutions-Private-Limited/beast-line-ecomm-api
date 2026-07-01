interface OtpEntry {
  otp: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpEntry>();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOtp = (email: string, otp: string): void => {
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });
};

export const verifyOtp = (email: string, otp: string): boolean => {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }
  if (entry.otp !== otp) return false;
  otpStore.delete(email.toLowerCase());
  return true;
};

export const isOtpExpired = (email: string): boolean => {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return true;
  return Date.now() > entry.expiresAt;
};
