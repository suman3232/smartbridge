// Helpers for reaching support over WhatsApp.

/**
 * Build a wa.me deep link from a phone number in any human format
 * (e.g. "+91 98765 43211") and an optional prefilled message.
 * WhatsApp requires the number as digits only, in full international form.
 */
export function whatsappLink(phone: string, message?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
