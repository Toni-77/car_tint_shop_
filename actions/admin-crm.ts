'use server';

// Quotes and customers for the admin page. Customers aren't stored separately:
// the list is built from all bookings and quotes each time, grouped by phone
// number (or email), so it can never get out of sync. Only customer notes are
// stored on their own, in "customerNotes".

import { Timestamp } from 'firebase-admin/firestore';
import { dbAdmin } from '@/utils/firebaseAdmin';
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth-server';
import { shopNow, slotToMinutes } from '@/lib/booking-rules';
import { customerKey } from '@/lib/customer-key';
import { formatPriceRange } from '@/lib/pricing';
import {
  BOOKING_STATUSES,
  STATUS_LABELS,
  type ActionResult,
  type BookingStatus,
  type Customer,
  type CustomerHistoryItem,
} from '@/lib/admin-types';
import {
  QUOTE_STATUS_LABELS,
  type AdminQuote,
  type QuoteStatus,
} from '@/lib/quote-types';

class UserError extends Error {}

async function run<T>(
  token: unknown,
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    await requireAdmin(token);
    return { ok: true, data: await action() };
  } catch (error) {
    if (error instanceof AdminAuthError || error instanceof UserError) {
      return { ok: false, error: error.message };
    }
    console.error('[Admin] Action failed:', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

const quotes = () => dbAdmin.collection('quotes');
const bookings = () => dbAdmin.collection('bookings');
const notes = () => dbAdmin.collection('customerNotes');

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === 'string' ? value : '';
}

function toQuote(id: string, d: FirebaseFirestore.DocumentData): AdminQuote {
  const status: QuoteStatus | null =
    d.status === 'new' || d.status === 'contacted' || d.status === 'booked'
      ? d.status
      : null;
  return {
    id,
    createdAt: toIso(d.createdAt),
    vehicleType: d.vehicleType ?? '',
    service: d.service ?? '',
    summary: d.summary ?? '',
    priceLow: Number(d.priceLow) || 0,
    priceHigh: Number(d.priceHigh) || 0,
    email: d.email ?? '',
    status,
    bookingId: d.bookingId ?? '',
    tintWindows: Array.isArray(d.tintWindows) ? d.tintWindows : [],
    removeOldTint: !!d.removeOldTint,
  };
}

const chicagoDate = (iso: string) => (iso ? shopNow(new Date(iso)).date : '');

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/** Quotes from the last `days` days, newest first. */
export async function adminListQuotes(
  token: string,
  days = 120,
): Promise<ActionResult<AdminQuote[]>> {
  return run(token, async () => {
    const since = Timestamp.fromMillis(
      Date.now() - Math.min(days, 730) * 86_400_000,
    );
    const snap = await quotes().where('createdAt', '>=', since).get();
    return snap.docs
      .map((doc) => toQuote(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/** How many quote requests are waiting for you (status "new"). */
export async function adminCountNewQuotes(
  token: string,
): Promise<ActionResult<number>> {
  return run(
    token,
    async () => (await quotes().where('status', '==', 'new').get()).docs.length,
  );
}

/** Marks a quote request as contacted (or back to new). */
export async function adminSetQuoteStatus(
  token: string,
  id: string,
  status: 'new' | 'contacted',
): Promise<ActionResult<AdminQuote>> {
  return run(token, async () => {
    if (status !== 'new' && status !== 'contacted')
      throw new UserError('Unknown status.');
    const ref = quotes().doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new UserError('Quote not found.');
    if (!snap.get('email'))
      throw new UserError('This estimate has no contact details.');
    if (snap.get('status') === 'booked')
      throw new UserError('This quote is already booked.');
    await ref.update({
      status,
      ...(status === 'contacted' ? { contactedAt: Timestamp.now() } : {}),
    });
    return toQuote(id, (await ref.get()).data()!);
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

type RawBooking = {
  id: string;
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  vehicle: string;
  vehicleType: string;
  service: string;
  options: string;
  date: string;
  timeSlot: string;
  status: BookingStatus;
  createdAt: string;
};

function toRawBooking(
  id: string,
  d: FirebaseFirestore.DocumentData,
): RawBooking {
  const status: BookingStatus = BOOKING_STATUSES.includes(d.status)
    ? d.status
    : 'requested';
  const vehicle = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model]
    .filter(Boolean)
    .join(' ');
  const tint = d.tint
    ? [
        d.tint.shade,
        Array.isArray(d.tint.windows) ? d.tint.windows.join(', ') : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return {
    id,
    key: customerKey(d.phone, d.email),
    firstName: d.firstName ?? '',
    lastName: d.lastName ?? '',
    phone: d.phone ?? '',
    email: (d.email ?? '').toLowerCase(),
    vehicle,
    vehicleType: d.vehicle?.type ?? '',
    service: d.service ?? '',
    options: tint,
    date: d.date ?? '',
    timeSlot: d.timeSlot ?? '',
    status,
    createdAt: toIso(d.createdAt),
  };
}

async function buildCustomers(): Promise<Customer[]> {
  const [bookingSnap, quoteSnap, noteSnap] = await Promise.all([
    bookings().get(),
    quotes().where('email', '>', '').get(),
    notes().get(),
  ]);
  const today = shopNow().date;
  const noteFor = new Map(
    noteSnap.docs.map((d) => [d.id, String(d.get('note') ?? '')]),
  );

  const rawBookings = bookingSnap.docs
    .map((doc) => toRawBooking(doc.id, doc.data()))
    .filter((b) => b.key);
  // An email used on any booking belongs to that booking's customer.
  const keyByEmail = new Map<string, string>();
  for (const b of rawBookings)
    if (b.email && !keyByEmail.has(b.email)) keyByEmail.set(b.email, b.key);

  type Group = { bookings: RawBooking[]; quotes: AdminQuote[] };
  const groups = new Map<string, Group>();
  const group = (key: string) => {
    if (!groups.has(key)) groups.set(key, { bookings: [], quotes: [] });
    return groups.get(key)!;
  };
  for (const b of rawBookings) group(b.key).bookings.push(b);
  for (const doc of quoteSnap.docs) {
    const q = toQuote(doc.id, doc.data());
    const mail = q.email.toLowerCase();
    if (!mail) continue;
    group(keyByEmail.get(mail) ?? customerKey(null, mail)).quotes.push(q);
  }

  const byTime = (a: RawBooking, b: RawBooking) =>
    b.date.localeCompare(a.date) ||
    (slotToMinutes(b.timeSlot) ?? 0) - (slotToMinutes(a.timeSlot) ?? 0);

  const customers: Customer[] = [];
  for (const [key, { bookings: list, quotes: qs }] of groups) {
    list.sort(byTime);
    // Name and contact details from the most recently made booking.
    const latest = [...list].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
    const active = (b: RawBooking) =>
      b.status === 'requested' || b.status === 'confirmed';
    const visited = list.filter(
      (b) =>
        b.status === 'completed' ||
        (b.status === 'confirmed' && b.date < today),
    );
    const upcoming = list
      .filter((b) => active(b) && b.date >= today)
      .sort((a, b) => -byTime(a, b))[0];

    const history: CustomerHistoryItem[] = [
      ...list.map((b) => ({
        kind: 'booking' as const,
        id: b.id,
        date: b.date,
        time: b.timeSlot,
        title: b.service,
        detail: [b.vehicle, b.options].filter(Boolean).join(' · '),
        status: STATUS_LABELS[b.status],
      })),
      ...qs.map((q) => ({
        kind: 'quote' as const,
        id: q.id,
        date: chicagoDate(q.createdAt),
        time: '',
        title: `Quote: ${q.service}`,
        detail: `${q.vehicleType} · ${q.summary} · ${formatPriceRange([q.priceLow, q.priceHigh])}`,
        status: q.status ? QUOTE_STATUS_LABELS[q.status] : 'Estimate',
      })),
    ].sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
    );

    const firstDates = [
      ...list.map((b) => chicagoDate(b.createdAt) || b.date),
      ...qs.map((q) => chicagoDate(q.createdAt)),
    ].filter(Boolean);

    customers.push({
      key,
      name: latest ? `${latest.firstName} ${latest.lastName}`.trim() : '',
      phone: latest?.phone ?? '',
      email: latest?.email || qs[0]?.email || '',
      vehicles: [...new Set(list.map((b) => b.vehicle).filter(Boolean))],
      bookings: list.length,
      completed: list.filter((b) => b.status === 'completed').length,
      noShows: list.filter((b) => b.status === 'no-show').length,
      quotes: qs.length,
      firstSeen: firstDates.sort()[0] ?? '',
      lastVisit: visited.length ? visited.sort(byTime)[0].date : null,
      nextBooking: upcoming
        ? { date: upcoming.date, time: upcoming.timeSlot }
        : null,
      note: noteFor.get(key) ?? '',
      history,
    });
  }
  return customers;
}

/** Every customer, built from all bookings and quotes. */
export async function adminListCustomers(
  token: string,
): Promise<ActionResult<Customer[]>> {
  return run(token, buildCustomers);
}

/** One customer's record (for the history shown on a booking). */
export async function adminGetCustomer(
  token: string,
  phone: string,
  email: string,
): Promise<ActionResult<Customer | null>> {
  return run(token, async () => {
    const all = await buildCustomers();
    const key = customerKey(phone, email);
    const mail = (email ?? '').toLowerCase();
    return (
      all.find((c) => c.key === key) ??
      (mail ? all.find((c) => c.email === mail) : undefined) ??
      null
    );
  });
}

/** Saves a note that stays with the customer across all their visits. */
export async function adminSaveCustomerNote(
  token: string,
  key: string,
  note: string,
): Promise<ActionResult<string>> {
  return run(token, async () => {
    const id = String(key ?? '');
    if (!/^(p:\d{10}|e:[^/\s]{3,254})$/.test(id))
      throw new UserError('Unknown customer.');
    const text = String(note ?? '')
      .trim()
      .slice(0, 1000);
    if (text)
      await notes().doc(id).set({ note: text, updatedAt: Timestamp.now() });
    else await notes().doc(id).delete();
    return text;
  });
}

// ---------------------------------------------------------------------------
// Exports (CSV text that opens in Excel or Google Sheets)
// ---------------------------------------------------------------------------

function toCsv(columns: string[], rows: string[][]): string {
  const cell = (value: string) => {
    const text = String(value ?? '');
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export async function adminExportCustomersCsv(
  token: string,
): Promise<ActionResult<string>> {
  return run(token, async () => {
    const list = (await buildCustomers()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return toCsv(
      [
        'Name',
        'Phone',
        'Email',
        'Vehicles',
        'Bookings',
        'Completed',
        'No-shows',
        'Quotes',
        'First seen',
        'Last visit',
        'Next booking',
        'Note',
      ],
      list.map((c) => [
        c.name,
        c.phone,
        c.email,
        c.vehicles.join('; '),
        String(c.bookings),
        String(c.completed),
        String(c.noShows),
        String(c.quotes),
        c.firstSeen,
        c.lastVisit ?? '',
        c.nextBooking ? `${c.nextBooking.date} ${c.nextBooking.time}` : '',
        c.note,
      ]),
    );
  });
}

export async function adminExportQuotesCsv(
  token: string,
  days = 365,
): Promise<ActionResult<string>> {
  const listed = await adminListQuotes(token, days);
  if (!listed.ok) return listed;
  return {
    ok: true,
    data: toCsv(
      [
        'Date',
        'Email',
        'Status',
        'Vehicle type',
        'Service',
        'Options',
        'Price low',
        'Price high',
      ],
      listed.data.map((q) => [
        chicagoDate(q.createdAt),
        q.email,
        q.status ? QUOTE_STATUS_LABELS[q.status] : 'Estimate only',
        q.vehicleType,
        q.service,
        q.summary,
        String(q.priceLow),
        String(q.priceHigh),
      ]),
    ),
  };
}
