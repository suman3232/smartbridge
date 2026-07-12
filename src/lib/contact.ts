// Helpers for reaching support over WhatsApp.

/**
 * Build a wa.me deep link from a phone number in any human format
 * (e.g. "+91 98765 43211") and an optional prefilled message.
 * WhatsApp requires the number as digits only, in full international form.
 */
export function whatsappLink(phone: string, message?: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // wa.me requires the FULL international number. Admins often save a bare
  // 10-digit Indian mobile (starts 6-9) — prefix the country code for them.
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
