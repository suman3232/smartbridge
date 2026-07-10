// Lightweight client-side validators. These check *format*, not live authenticity
// (verifying a PAN against the Income Tax database needs a paid KYC provider API).

/** Indian PAN: 5 letters, 4 digits, 1 letter — e.g. ABCDE1234F. */
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// 4th character encodes the holder type. P=Individual, C=Company, H=HUF, F=Firm,
// A=AOP, T=Trust, B=BOI, L=Local authority, J=Artificial juridical person, G=Govt.
const PAN_HOLDER_TYPES = new Set(["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"]);

export function normalizePan(value: string): string {
  return (value ?? "").toUpperCase().replace(/\s/g, "");
}

/** True when the string is a structurally valid PAN. */
export function isValidPan(value: string): boolean {
  const pan = normalizePan(value);
  return PAN_RE.test(pan) && PAN_HOLDER_TYPES.has(pan[3]);
}

/** Human-readable reason a PAN is invalid, or null when it's fine. */
export function panError(value: string): string | null {
  const pan = normalizePan(value);
  if (!pan) return "PAN is required.";
  if (pan.length !== 10) return "PAN must be exactly 10 characters (e.g. ABCDE1234F).";
  if (!PAN_RE.test(pan)) return "Invalid format. Use 5 letters, 4 digits, then 1 letter (e.g. ABCDE1234F).";
  if (!PAN_HOLDER_TYPES.has(pan[3])) return "The 4th character isn't a valid PAN holder type.";
  return null;
}

/** Basic phone sanity check: 8–15 digits after stripping formatting. */
export function isValidPhone(value: string): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
