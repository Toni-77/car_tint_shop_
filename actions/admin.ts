'use server';

// Everything the admin page can do. Each action first checks that the request
// comes from the signed-in shop owner (requireAdmin), then works in Firestore.
//
// Collections:
//   bookings  one document per appointment (website or admin)
//   slots     one document per taken time, id "YYYY-MM-DD_HHMM". A document with
//             kind "block" is a time you blocked; otherwise it holds a booking.
//             The website hides every time that has a slot document.

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { dbAdmin } from '@/utils/firebaseAdmin';
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth-server';
import { sendCustomerEmail, type EmailResult } from '@/lib/customer-email';
import { markQuotesBooked } from '@/lib/quote-links';
import {
  FILM_REMOVAL_OPTIONS,
  NOTES_MAX_LENGTH,
  SERVICES,
  TINT_SHADES,
  TINT_WINDOWS,
  VEHICLE_TYPES,
  getOpeningSlots,
  isValidDateString,
  normalizeUSPhone,
  shopNow,
  shopTimeToDate,
  slotId,
  slotToMinutes,
  validEmail,
  validNotes,
  validPersonName,
  validVehicleText,
} from '@/lib/booking-rules';
import {
  BOOKING_STATUSES,
  STATUS_LABELS,
  type ActionResult,
  type AdminBooking,
  type BookingStatus,
  type CalendarSlot,
  type NewBookingInput,
} from '@/lib/admin-types';

class UserError extends Error {}

const bookings = () => dbAdmin.collection('bookings');
const slots = () => dbAdmin.collection('slots');

/** Runs an admin action with the sign-in check and friendly error messages. */
async function run<T>(
  token: unknown,
  action: () => Promise<{ data: T } & Partial<EmailResult>>,
): Promise<ActionResult<T>> {
  try {
    await requireAdmin(token);
    const result = await action();
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof AdminAuthError || error instanceof UserError) {
      return { ok: false, error: error.message };
    }
    console.error('[Admin] Action failed:', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

function historyEntry(action: string) {
  return FieldValue.arrayUnion({ at: new Date().toISOString(), action });
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
}

/** Turns a Firestore booking into the plain shape the admin page uses. Older
 *  website bookings (before statuses existed) count as "requested". */
function toAdminBooking(
  id: string,
  d: FirebaseFirestore.DocumentData,
): AdminBooking {
  const status = BOOKING_STATUSES.includes(d.status) ? d.status : 'requested';
  return {
    id,
    status,
    source: d.source === 'admin' ? 'admin' : 'website',
    firstName: d.firstName ?? '',
    lastName: d.lastName ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    vehicle: {
      type: d.vehicle?.type ?? '',
      year: d.vehicle?.year ?? '',
      make: d.vehicle?.make ?? '',
      model: d.vehicle?.model ?? '',
    },
    service: d.service ?? '',
    tint: d.tint
      ? {
          shade: d.tint.shade ?? '',
          windows: Array.isArray(d.tint.windows) ? d.tint.windows : [],
          removeOldFilm: d.tint.removeOldFilm ?? '',
        }
      : null,
    notes: d.notes ?? '',
    date: d.date ?? '',
    timeSlot: d.timeSlot ?? '',
    slotId:
      d.slotId ?? (d.date && d.timeSlot ? slotId(d.date, d.timeSlot) : ''),
    createdAt: toIso(d.createdAt),
    adminNotes: Array.isArray(d.adminNotes) ? d.adminNotes : [],
    history: Array.isArray(d.history) ? d.history : [],
  };
}

function checkDate(date: unknown): string {
  if (typeof date !== 'string' || !isValidDateString(date)) {
    throw new UserError('Invalid date.');
  }
  return date;
}

/** Times that can still be booked from the admin page on a date: opening hours,
 *  not already past (today), and with no booking or block on them. */
async function openTimes(date: string): Promise<string[]> {
  const today = shopNow();
  if (date < today.date) return [];
  const taken = new Set(
    (await slots().where('date', '==', date).get()).docs.map((doc) => doc.id),
  );
  return getOpeningSlots(date).filter((time) => {
    if (taken.has(slotId(date, time))) return false;
    return date > today.date || (slotToMinutes(time) ?? 0) > today.minutes;
  });
}

async function emailCustomer(
  kind: 'confirmed' | 'rescheduled',
  booking: AdminBooking,
): Promise<EmailResult> {
  const result = await sendCustomerEmail(kind, booking);
  await bookings()
    .doc(booking.id)
    .update({
      history: historyEntry(
        result.emailSent
          ? `Emailed customer (${kind === 'confirmed' ? 'confirmation' : 'new time'})`
          : `Customer email not sent: ${result.emailError ?? 'unknown error'}`,
      ),
    });
  return result;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Bookings with appointment dates from `from` to `to` (inclusive). */
export async function adminListBookings(
  token: string,
  from: string,
  to: string,
): Promise<ActionResult<AdminBooking[]>> {
  return run(token, async () => {
    checkDate(from);
    checkDate(to);
    const snap = await bookings()
      .where('date', '>=', from)
      .where('date', '<=', to)
      .orderBy('date')
      .get();
    const list = snap.docs
      .map((doc) => toAdminBooking(doc.id, doc.data()))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (slotToMinutes(a.timeSlot) ?? 0) - (slotToMinutes(b.timeSlot) ?? 0),
      );
    return { data: list };
  });
}

export async function adminGetBooking(
  token: string,
  id: string,
): Promise<ActionResult<AdminBooking>> {
  return run(token, async () => {
    const doc = await bookings().doc(String(id)).get();
    if (!doc.exists) throw new UserError('Booking not found.');
    return { data: toAdminBooking(doc.id, doc.data()!) };
  });
}

/** Everything the week calendar needs: bookings and taken/blocked times. */
export async function adminGetCalendar(
  token: string,
  from: string,
  to: string,
): Promise<ActionResult<{ bookings: AdminBooking[]; slots: CalendarSlot[] }>> {
  return run(token, async () => {
    checkDate(from);
    checkDate(to);
    const [bookingSnap, slotSnap] = await Promise.all([
      bookings().where('date', '>=', from).where('date', '<=', to).get(),
      slots().where('date', '>=', from).where('date', '<=', to).get(),
    ]);
    return {
      data: {
        bookings: bookingSnap.docs.map((doc) =>
          toAdminBooking(doc.id, doc.data()),
        ),
        slots: slotSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.date,
            timeSlot: d.timeSlot,
            kind: d.kind === 'block' ? 'block' : 'booking',
            bookingId: d.bookingId,
            reason: d.reason ?? '',
          } satisfies CalendarSlot;
        }),
      },
    };
  });
}

/**
 * Bookings made before time slots existed don't hold their time, so the website
 * could book the same time again. This gives every upcoming requested or confirmed
 * booking its time-slot record. If another booking already holds that time, the
 * booking is left as is and counted as a conflict (shown as Double-booked).
 */
export async function adminHoldOlderBookings(
  token: string,
): Promise<ActionResult<{ held: number; conflicts: number }>> {
  return run(token, async () => {
    const today = shopNow().date;
    const snap = await bookings().where('date', '>=', today).get();
    let held = 0;
    let conflicts = 0;
    for (const doc of snap.docs) {
      // Bookings made since time slots existed already hold their time.
      if (doc.get('slotId')) continue;
      const booking = toAdminBooking(doc.id, doc.data());
      if (booking.status !== 'requested' && booking.status !== 'confirmed')
        continue;
      if (!booking.date || slotToMinutes(booking.timeSlot) === null) continue;
      const id = slotId(booking.date, booking.timeSlot);
      await dbAdmin.runTransaction(async (tx) => {
        const slotRef = slots().doc(id);
        const slot = await tx.get(slotRef);
        if (slot.exists) {
          if (slot.get('bookingId') !== booking.id) conflicts += 1;
          return;
        }
        tx.create(slotRef, {
          date: booking.date,
          timeSlot: booking.timeSlot,
          bookingId: booking.id,
          createdAt: Timestamp.now(),
        });
        tx.update(bookings().doc(booking.id), { slotId: id });
        held += 1;
      });
    }
    return { data: { held, conflicts } };
  });
}

/** Open times on a date, for adding or rescheduling a booking. */
export async function adminOpenTimes(
  token: string,
  date: string,
): Promise<ActionResult<string[]>> {
  return run(token, async () => ({ data: await openTimes(checkDate(date)) }));
}

// ---------------------------------------------------------------------------
// Changing a booking
// ---------------------------------------------------------------------------

const STATUS_ACTIONS: Record<BookingStatus, string> = {
  requested: 'Marked as requested',
  confirmed: 'Confirmed',
  completed: 'Marked done',
  cancelled: 'Cancelled (time freed)',
  'no-show': 'Marked as no-show',
};

/**
 * Changes a booking's status. Cancelling frees its time so customers can book
 * it again. With sendEmail, confirming also emails the customer.
 */
export async function adminSetStatus(
  token: string,
  id: string,
  status: BookingStatus,
  sendEmail = false,
): Promise<ActionResult<AdminBooking>> {
  return run(token, async () => {
    if (!BOOKING_STATUSES.includes(status))
      throw new UserError('Unknown status.');
    const ref = bookings().doc(String(id));

    await dbAdmin.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new UserError('Booking not found.');
      const booking = toAdminBooking(snap.id, snap.data()!);
      if (booking.status === status) {
        throw new UserError(
          `This booking is already ${STATUS_LABELS[status].toLowerCase()}.`,
        );
      }
      if (booking.status === 'cancelled') {
        throw new UserError(
          'This booking was cancelled. Add a new booking instead.',
        );
      }

      if (status === 'cancelled' && booking.slotId) {
        const slotRef = slots().doc(booking.slotId);
        const slot = await tx.get(slotRef);
        if (slot.exists && slot.get('bookingId') === booking.id)
          tx.delete(slotRef);
      }
      tx.update(ref, {
        status,
        updatedAt: Timestamp.now(),
        history: historyEntry(STATUS_ACTIONS[status]),
      });
    });

    const updated = toAdminBooking(id, (await ref.get()).data()!);
    if (status === 'confirmed' && sendEmail) {
      const email = await emailCustomer('confirmed', updated);
      const fresh = toAdminBooking(id, (await ref.get()).data()!);
      return { data: fresh, ...email };
    }
    return { data: updated };
  });
}

/** Moves a booking to a new open time, freeing the old one. */
export async function adminReschedule(
  token: string,
  id: string,
  date: string,
  timeSlot: string,
  sendEmail = false,
): Promise<ActionResult<AdminBooking>> {
  return run(token, async () => {
    checkDate(date);
    if (!getOpeningSlots(date).includes(timeSlot)) {
      throw new UserError('That time is outside opening hours.');
    }
    const ref = bookings().doc(String(id));
    const newSlotRef = slots().doc(slotId(date, timeSlot));

    await dbAdmin.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new UserError('Booking not found.');
      const booking = toAdminBooking(snap.id, snap.data()!);
      if (!['requested', 'confirmed'].includes(booking.status)) {
        throw new UserError(
          `A ${STATUS_LABELS[booking.status].toLowerCase()} booking can't be rescheduled.`,
        );
      }
      if (booking.slotId === newSlotRef.id)
        throw new UserError('That is already the booked time.');

      const newSlot = await tx.get(newSlotRef);
      if (newSlot.exists)
        throw new UserError('That time is already taken or blocked.');
      const oldSlotRef = booking.slotId ? slots().doc(booking.slotId) : null;
      const oldSlot = oldSlotRef ? await tx.get(oldSlotRef) : null;

      if (
        oldSlotRef &&
        oldSlot?.exists &&
        oldSlot.get('bookingId') === booking.id
      ) {
        tx.delete(oldSlotRef);
      }
      tx.create(newSlotRef, {
        date,
        timeSlot,
        bookingId: booking.id,
        createdAt: Timestamp.now(),
      });
      tx.update(ref, {
        date,
        timeSlot,
        slotId: newSlotRef.id,
        appointmentTimestamp: Timestamp.fromDate(
          shopTimeToDate(date, timeSlot),
        ),
        updatedAt: Timestamp.now(),
        history: historyEntry(
          `Rescheduled from ${booking.date} ${booking.timeSlot} to ${date} ${timeSlot}`,
        ),
      });
    });

    const updated = toAdminBooking(id, (await ref.get()).data()!);
    if (sendEmail) {
      const email = await emailCustomer('rescheduled', updated);
      return { data: toAdminBooking(id, (await ref.get()).data()!), ...email };
    }
    return { data: updated };
  });
}

/** Adds a private note to a booking (only visible on the admin page). */
export async function adminAddNote(
  token: string,
  id: string,
  text: string,
): Promise<ActionResult<AdminBooking>> {
  return run(token, async () => {
    const note = String(text ?? '').trim();
    if (!note) throw new UserError('Write a note first.');
    if (note.length > 1000)
      throw new UserError('Notes can be up to 1,000 characters.');
    const ref = bookings().doc(String(id));
    if (!(await ref.get()).exists) throw new UserError('Booking not found.');
    await ref.update({
      adminNotes: FieldValue.arrayUnion({
        at: new Date().toISOString(),
        text: note,
      }),
    });
    return { data: toAdminBooking(id, (await ref.get()).data()!) };
  });
}

// ---------------------------------------------------------------------------
// Blocking times
// ---------------------------------------------------------------------------

/** Blocks the given times on a date (or the whole day) so customers can't book them. */
export async function adminBlockTimes(
  token: string,
  date: string,
  times: string[] | 'whole-day',
  reason: string,
): Promise<ActionResult<{ blocked: number; skipped: number }>> {
  return run(token, async () => {
    checkDate(date);
    const opening = getOpeningSlots(date);
    const wanted =
      times === 'whole-day'
        ? opening
        : times.filter((t) => opening.includes(t));
    if (wanted.length === 0)
      throw new UserError('Choose at least one open time to block.');
    const cleanReason = String(reason ?? '')
      .trim()
      .slice(0, 120);

    let blocked = 0;
    let skipped = 0;
    // create() fails if the time already has a booking or block, which is what we want.
    await Promise.all(
      wanted.map(async (time) => {
        try {
          await slots().doc(slotId(date, time)).create({
            date,
            timeSlot: time,
            kind: 'block',
            reason: cleanReason,
            createdAt: Timestamp.now(),
          });
          blocked += 1;
        } catch {
          skipped += 1;
        }
      }),
    );
    return { data: { blocked, skipped } };
  });
}

/** Unblocks times. Only removes blocks, never a customer's booking. */
export async function adminUnblockTimes(
  token: string,
  slotIds: string[],
): Promise<ActionResult<{ unblocked: number }>> {
  return run(token, async () => {
    let unblocked = 0;
    await Promise.all(
      (Array.isArray(slotIds) ? slotIds : []).map((sid) =>
        dbAdmin.runTransaction(async (tx) => {
          const ref = slots().doc(String(sid));
          const snap = await tx.get(ref);
          if (snap.exists && snap.get('kind') === 'block') {
            tx.delete(ref);
            unblocked += 1;
          }
        }),
      ),
    );
    return { data: { unblocked } };
  });
}

// ---------------------------------------------------------------------------
// Adding a booking (phone calls and walk-ins)
// ---------------------------------------------------------------------------

const NewBookingSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES, {
    errorMap: () => ({ message: 'Choose a vehicle type' }),
  }),
  year: z.string().regex(/^\d{4}$/, 'Enter a 4-digit year'),
  make: z
    .string()
    .trim()
    .min(1, 'Enter the make')
    .refine(validVehicleText, 'Check the make'),
  model: z
    .string()
    .trim()
    .min(1, 'Enter the model')
    .refine(validVehicleText, 'Check the model'),
  service: z.enum(SERVICES, {
    errorMap: () => ({ message: 'Choose a service' }),
  }),
  tintShade: z.enum(TINT_SHADES).optional(),
  tintWindows: z.array(z.enum(TINT_WINDOWS)).default([]),
  filmRemoval: z.enum(FILM_REMOVAL_OPTIONS).optional(),
  firstName: z.string().trim().refine(validPersonName, 'Check the first name'),
  lastName: z.string().trim().refine(validPersonName, 'Check the last name'),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizeUSPhone(value);
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a 10-digit US phone number',
      });
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || validEmail(v), 'Check the email address')
    .default(''),
  date: z.string().refine(isValidDateString, 'Choose a date'),
  timeSlot: z.string().min(1, 'Choose a time'),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH)
    .refine(validNotes, 'Remove < > from the notes')
    .default(''),
  status: z.enum(['requested', 'confirmed']),
  quoteId: z.string().max(100).optional(),
  sendEmail: z.boolean(),
});

export async function adminCreateBooking(
  token: string,
  input: NewBookingInput,
): Promise<ActionResult<AdminBooking>> {
  return run(token, async () => {
    const parsed = NewBookingSchema.safeParse(input);
    if (!parsed.success) {
      throw new UserError(
        [...new Set(parsed.error.errors.map((e) => e.message))].join(' · '),
      );
    }
    const d = parsed.data;
    if (!(await openTimes(d.date)).includes(d.timeSlot)) {
      throw new UserError('That time is no longer open. Choose another time.');
    }

    const bookingRef = bookings().doc();
    const slotRef = slots().doc(slotId(d.date, d.timeSlot));
    const isTint = d.service === 'Window Tint';

    await dbAdmin.runTransaction(async (tx) => {
      if ((await tx.get(slotRef)).exists) {
        throw new UserError('That time was just taken. Choose another time.');
      }
      tx.create(slotRef, {
        date: d.date,
        timeSlot: d.timeSlot,
        bookingId: bookingRef.id,
        createdAt: Timestamp.now(),
      });
      tx.create(bookingRef, {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        vehicle: {
          type: d.vehicleType,
          year: d.year,
          make: d.make,
          model: d.model,
        },
        service: d.service,
        tint: isTint
          ? {
              shade: d.tintShade ?? '',
              windows: d.tintWindows,
              removeOldFilm: d.filmRemoval ?? '',
            }
          : null,
        notes: d.notes,
        quoteId: d.quoteId ?? null,
        date: d.date,
        timeSlot: d.timeSlot,
        slotId: slotRef.id,
        status: d.status,
        source: 'admin',
        createdAt: Timestamp.now(),
        appointmentTimestamp: Timestamp.fromDate(
          shopTimeToDate(d.date, d.timeSlot),
        ),
        history: [
          {
            at: new Date().toISOString(),
            action: `Added from admin page as ${STATUS_LABELS[d.status].toLowerCase()}`,
          },
        ],
        adminNotes: [],
      });
    });

    await markQuotesBooked({
      quoteId: d.quoteId,
      email: d.email,
      bookingId: bookingRef.id,
    });
    const created = toAdminBooking(
      bookingRef.id,
      (await bookingRef.get()).data()!,
    );
    if (d.sendEmail && d.status === 'confirmed') {
      const email = await emailCustomer('confirmed', created);
      return {
        data: toAdminBooking(bookingRef.id, (await bookingRef.get()).data()!),
        ...email,
      };
    }
    return { data: created };
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Bookings between two dates as CSV text (opens in Excel or Google Sheets). */
export async function adminExportCsv(
  token: string,
  from: string,
  to: string,
): Promise<ActionResult<string>> {
  const listed = await adminListBookings(token, from, to);
  if (!listed.ok) return listed;

  const columns = [
    'Date',
    'Time',
    'Status',
    'First name',
    'Last name',
    'Phone',
    'Email',
    'Vehicle type',
    'Year',
    'Make',
    'Model',
    'Service',
    'Tint shade',
    'Windows',
    'Remove old film',
    'Customer notes',
    'Admin notes',
    'Source',
    'Booked on',
  ];
  const cell = (value: string) => {
    const text = String(value ?? '');
    // Prevent spreadsheet formulas from running, and quote everything safely.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = listed.data.map((b) =>
    [
      b.date,
      b.timeSlot,
      STATUS_LABELS[b.status],
      b.firstName,
      b.lastName,
      b.phone,
      b.email,
      b.vehicle.type,
      b.vehicle.year,
      b.vehicle.make,
      b.vehicle.model,
      b.service,
      b.tint?.shade ?? '',
      b.tint?.windows.join('; ') ?? '',
      b.tint?.removeOldFilm ?? '',
      b.notes,
      b.adminNotes.map((n) => n.text).join(' | '),
      b.source,
      b.createdAt.slice(0, 10),
    ]
      .map(cell)
      .join(','),
  );
  return {
    ok: true,
    data: [columns.map(cell).join(','), ...rows].join('\r\n'),
  };
}
