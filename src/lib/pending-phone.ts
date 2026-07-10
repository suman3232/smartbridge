// Carries the mobile number entered on the signup form through to the profile.
// The DB trigger also writes it from auth metadata, but this client-side backfill
// makes it work even on databases whose trigger predates the phone column — and
// survives the email-OTP step (the number is applied once a session exists).

const KEY = "offerbridge_pending_phone";

export function storePendingPhone(phone: string) {
  try {
    const v = (phone ?? "").trim();
    if (v) localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function getPendingPhone(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearPendingPhone() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
