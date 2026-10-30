// One customer = one phone number (or email when there's no phone).
// Used to group bookings and quotes into customers.
export function customerKey(
  phone?: string | null,
  email?: string | null,
): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length === 10) return `p:${digits}`;
  const mail = (email ?? '').trim().toLowerCase();
  return mail ? `e:${mail}` : '';
}
