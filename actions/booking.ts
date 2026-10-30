'use server';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { Resend } from 'resend';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { dbAdmin } from '@/utils/firebaseAdmin';
import {
  FILM_REMOVAL_OPTIONS,
  NOTES_MAX_LENGTH,
  SERVICES,
  TINT_SHADES,
  TINT_WINDOWS,
  VEHICLE_TYPES,
  formatDisplayDate,
  getAvailableTimeSlots,
  isValidDateString,
  normalizeUSPhone,
  shopTimeToDate,
  slotId,
  validEmail,
  validNotes,
  validPersonName,
  validVehicleText,
} from '@/lib/booking-rules';

const resend = new Resend(process.env.RESEND_API_KEY);

// Spam limits: requests per visitor (by IP address) per hour, and the fastest a
// person could realistically fill in all three steps of the form.
const MAX_REQUESTS_PER_HOUR = 5;
const MIN_FILL_TIME_MS = 4000;

const SLOT_TAKEN_MESSAGE =
  'Sorry, that time was just booked by someone else. Please pick another time.';

// Every rule the form checks is checked again here, because anyone can send a
// request straight to the server without using the form.
const BookingSchema = z
  .object({
    vehicleType: z.enum(VEHICLE_TYPES, {
      errorMap: () => ({ message: 'Please select a vehicle type' }),
    }),
    firstName: z
      .string()
      .trim()
      .refine(validPersonName, 'Please enter a valid first name'),
    lastName: z
      .string()
      .trim()
      .refine(validPersonName, 'Please enter a valid last name'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine(validEmail, 'Please provide a valid email address'),
    phone: z.string().transform((value, ctx) => {
      const phone = normalizeUSPhone(value);
      if (!phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid 10-digit US phone number',
        });
        return z.NEVER;
      }
      return phone;
    }),
    year: z
      .string()
      .regex(/^\d{4}$/, 'Year must be exactly 4 digits')
      .refine((value) => {
        const year = Number(value);
        return year >= 1900 && year <= new Date().getFullYear() + 1;
      }, 'Please enter a valid automotive year'),
    make: z
      .string()
      .trim()
      .min(1, 'Vehicle make is required')
      .refine(
        validVehicleText,
        'Please remove unsupported characters from the make',
      ),
    model: z
      .string()
      .trim()
      .min(1, 'Vehicle model is required')
      .refine(
        validVehicleText,
        'Please remove unsupported characters from the model',
      ),
    service: z.enum(SERVICES, {
      errorMap: () => ({ message: 'Please select a service' }),
    }),
    tintShade: z.enum(TINT_SHADES).optional(),
    tintWindows: z
      .array(z.enum(TINT_WINDOWS))
      .max(TINT_WINDOWS.length)
      .default([]),
    filmRemoval: z.enum(FILM_REMOVAL_OPTIONS).optional(),
    notes: z
      .string()
      .trim()
      .max(
        NOTES_MAX_LENGTH,
        `Notes can be up to ${NOTES_MAX_LENGTH} characters`,
      )
      .refine(
        validNotes,
        'Please remove < > or hidden characters from your notes',
      )
      .default(''),
    date: z.string().refine(isValidDateString, 'Invalid date'),
    timeSlot: z.string().trim().min(1, 'Please select a time slot'),
  })
  .superRefine((data, ctx) => {
    if (data.service === 'Window Tint') {
      if (!data.tintShade) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please choose a tint shade',
        });
      }
      if (data.tintWindows.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please choose which windows to tint',
        });
      }
      if (!data.filmRemoval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please tell us if old film needs removing',
        });
      }
    }
    // Business hours, Sundays, holidays, past dates and lead time, in Chicago time.
    if (!getAvailableTimeSlots(data.date).includes(data.timeSlot)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'That appointment time is not available. Please pick another time.',
      });
    }
  });

type BookingInput = z.infer<typeof BookingSchema>;

class SlotTakenError extends Error {}
class RateLimitError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function isBotSubmission(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const { website, elapsedMs } = raw as {
    website?: unknown;
    elapsedMs?: unknown;
  };
  // "website" is a hidden field people never see; bots fill in every field.
  if (typeof website === 'string' && website.trim() !== '') return true;
  // Nobody completes three steps in a few seconds.
  if (typeof elapsedMs === 'number' && elapsedMs < MIN_FILL_TIME_MS)
    return true;
  return false;
}

async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-nf-client-connection-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  // Store a hash, never the raw IP address.
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

async function enforceRateLimit(): Promise<void> {
  const ref = dbAdmin.collection('rate_limits').doc(await visitorKey());
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;

  await dbAdmin.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const recent = (
      (snap.get('requests') as number[] | undefined) ?? []
    ).filter((time) => time > windowStart);
    if (recent.length >= MAX_REQUESTS_PER_HOUR) {
      throw new RateLimitError(
        'Too many booking requests from this connection. Please try again later or give us a call.',
      );
    }
    tx.set(ref, { requests: [...recent, now], updatedAt: Timestamp.now() });
  });
}

/** Times already booked on a date, so the form can hide them. */
export async function getBookedSlots(date: string): Promise<string[]> {
  if (typeof date !== 'string' || !isValidDateString(date)) return [];
  try {
    const snap = await dbAdmin
      .collection('slots')
      .where('date', '==', date)
      .get();
    return snap.docs
      .map((doc) => doc.get('timeSlot') as string)
      .filter(Boolean);
  } catch (error) {
    console.error('[Booking] Could not load booked slots:', error);
    return []; // The server still refuses taken times when the request is sent.
  }
}

function buildEmailHtml(data: BookingInput, bookingId: string): string {
  const e = escapeHtml;
  const row = (label: string, value: string, bold = false) => `
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 35%; vertical-align: top;"><strong>${label}:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;${bold ? ' font-weight: bold;' : ''}">${value}</td>
            </tr>`;

  const tintRows =
    data.service === 'Window Tint'
      ? row('Tint shade', e(data.tintShade ?? '')) +
        row('Windows', e(data.tintWindows.join(', '))) +
        row('Remove old film', e(data.filmRemoval ?? ''))
      : '';

  const notes = data.notes
    ? `
          <div style="margin-top: 16px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 14px;"><strong>Customer notes</strong></p>
            <p style="margin: 8px 0 0; font-size: 14px; white-space: pre-wrap;">${e(data.notes)}</p>
          </div>`
    : '';

  return `
        <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; max-width: 600px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-top: 0; font-size: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">
            New Appointment Request
          </h2>

          <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
            ${row('Customer', `${e(data.firstName)} ${e(data.lastName)}`)}
            ${row('Vehicle', `${e(data.year)} ${e(data.make)} ${e(data.model)} (${e(data.vehicleType)})`)}
            ${row('Service', e(data.service))}
            ${tintRows}
            ${row('Requested appointment', `${e(formatDisplayDate(data.date))} at ${e(data.timeSlot)}`, true)}
          </table>
          ${notes}

          <div style="margin-top: 16px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 14px;"><strong>Contact Information</strong></p>
            <p style="margin: 8px 0 0; font-size: 14px;">
              Phone: <a href="tel:${e(data.phone)}" style="color: #2563eb; text-decoration: none;">${e(data.phone)}</a>
            </p>
            <p style="margin: 4px 0 0; font-size: 14px;">
              Email: <a href="mailto:${e(data.email)}" style="color: #2563eb; text-decoration: none;">${e(data.email)}</a>
            </p>
          </div>

          <p style="margin-top: 24px; margin-bottom: 0; font-size: 11px; color: #94a3b8;">
            Firestore Document ID: ${e(bookingId)}
          </p>
        </div>
      `;
}

export async function sendManualBookingRequest(rawFormData: unknown) {
  try {
    if (isBotSubmission(rawFormData)) {
      console.warn('[Booking] Ignored a likely bot submission');
      // Look successful so the bot doesn't retry, but save and send nothing.
      return { success: true, bookingId: null, emailSent: false };
    }

    const parsed = BookingSchema.safeParse(rawFormData);
    if (!parsed.success) {
      const issueSummary = [
        ...new Set(parsed.error.errors.map((err) => err.message)),
      ].join(' | ');
      return { success: false, error: issueSummary };
    }
    const data = parsed.data;

    if (!process.env.RESEND_API_KEY || !process.env.MY_EMAIL) {
      console.error(
        '[Booking] Required email environment variables are missing.',
      );
      return {
        success: false,
        error:
          'The booking email service is not configured. Please try again later.',
      };
    }

    await enforceRateLimit();

    const isTint = data.service === 'Window Tint';
    const slotRef = dbAdmin
      .collection('slots')
      .doc(slotId(data.date, data.timeSlot));
    const bookingRef = dbAdmin.collection('bookings').doc();

    // The slot document is the lock: only one booking can create it, so two
    // customers can never get the same time. To free a time (for example after
    // a cancellation), delete its document from the "slots" collection. To block
    // a time yourself, add one.
    await dbAdmin.runTransaction(async (tx) => {
      const slot = await tx.get(slotRef);
      if (slot.exists) throw new SlotTakenError(SLOT_TAKEN_MESSAGE);

      tx.create(slotRef, {
        date: data.date,
        timeSlot: data.timeSlot,
        bookingId: bookingRef.id,
        createdAt: Timestamp.now(),
      });
      tx.create(bookingRef, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        vehicle: {
          type: data.vehicleType,
          year: data.year,
          make: data.make,
          model: data.model,
        },
        service: data.service,
        tint: isTint
          ? {
              shade: data.tintShade,
              windows: data.tintWindows,
              removeOldFilm: data.filmRemoval,
            }
          : null,
        notes: data.notes,
        date: data.date,
        timeSlot: data.timeSlot,
        slotId: slotRef.id,
        status: 'requested',
        createdAt: Timestamp.now(),
        // Saved as the real moment in Chicago time, not the server's time zone.
        appointmentTimestamp: Timestamp.fromDate(
          shopTimeToDate(data.date, data.timeSlot),
        ),
      });
    });

    console.info('[Booking] Saved booking:', bookingRef.id);

    const { data: emailData, error } = await resend.emails.send({
      from: 'Tint Car Appointment <onboarding@resend.dev>',
      to: [process.env.MY_EMAIL],
      replyTo: data.email,
      subject: `Tint Car Appointment: ${formatDisplayDate(data.date)} at ${data.timeSlot}`,
      html: buildEmailHtml(data, bookingRef.id),
    });

    if (error) {
      // The booking is saved, so the customer still sees success.
      console.error('[Booking] Email delivery failed raw details:', error);
      return { success: true, bookingId: bookingRef.id, emailSent: false };
    }

    console.info('[Booking] Email sent:', emailData?.id);
    return { success: true, bookingId: bookingRef.id, emailSent: true };
  } catch (error: unknown) {
    if (error instanceof SlotTakenError) {
      return { success: false, error: error.message, slotTaken: true };
    }
    if (error instanceof RateLimitError) {
      return { success: false, error: error.message };
    }
    console.error('Server Action Processing Error:', error);
    return {
      success: false,
      error:
        'Something went wrong sending your request. Please try again or give us a call.',
    };
  }
}