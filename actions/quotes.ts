'use server';

// Saving Get Quote estimates from the website.
//
// Collection "quotes": one document per estimate a visitor put together.
//   status null        an estimate with no contact details (shows demand)
//   status "new"       the visitor asked for the quote by email (a lead)
//   status "contacted" you marked it as followed up
//   status "booked"    that person booked (linked automatically)

import { Resend } from 'resend';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { dbAdmin } from '@/utils/firebaseAdmin';
import { VEHICLE_TYPES, validEmail } from '@/lib/booking-rules';
import {
  COATING_PACKAGES,
  PPF_PACKAGES,
  TINT_ADD_ONS,
  TINT_COVERAGE,
  TINT_FILMS,
  describeSelection,
  estimatePrice,
  formatPriceRange,
  tintWindowsFor,
  type QuoteSelection,
} from '@/lib/pricing';
import { sendQuoteEmail } from '@/lib/customer-email';
import { underRateLimit } from '@/lib/rate-limit';

const quotes = () => dbAdmin.collection('quotes');

// An anonymous estimate can keep being updated while the visitor changes options.
const UPDATE_WINDOW_MS = 2 * 60 * 60 * 1000;

const vehicleType = z.enum(VEHICLE_TYPES);
const SelectionSchema = z.discriminatedUnion('service', [
  z.object({
    service: z.literal('Window Tint'),
    vehicleType,
    film: z.enum(TINT_FILMS),
    coverage: z.enum(TINT_COVERAGE),
    addOns: z
      .array(z.enum(TINT_ADD_ONS.map((a) => a.id) as [string, ...string[]]))
      .max(TINT_ADD_ONS.length),
    removeOldTint: z.boolean(),
  }),
  z.object({
    service: z.literal('Ceramic Coating'),
    vehicleType,
    coatingPackage: z.enum(COATING_PACKAGES),
  }),
  z.object({
    service: z.literal('Paint Protection Film'),
    vehicleType,
    ppfPackage: z.enum(PPF_PACKAGES),
  }),
]);

/** Everything saved about an estimate, worked out on the server (prices included). */
function quoteFields(selection: QuoteSelection) {
  const [priceLow, priceHigh] = estimatePrice(selection);
  return {
    vehicleType: selection.vehicleType,
    service: selection.service,
    summary: describeSelection(selection),
    priceLow,
    priceHigh,
    tintWindows: tintWindowsFor(selection),
    removeOldTint:
      selection.service === 'Window Tint' ? selection.removeOldTint : false,
    selection,
  };
}

/** Finds an estimate this visitor may still update: no contact yet, and recent. */
async function updatableQuote(quoteId: unknown) {
  if (typeof quoteId !== 'string' || !quoteId || quoteId.length > 100)
    return null;
  const snap = await quotes().doc(quoteId).get();
  if (!snap.exists || snap.get('email') || snap.get('status')) return null;
  const created = snap.get('createdAt');
  if (
    !(created instanceof Timestamp) ||
    Date.now() - created.toMillis() > UPDATE_WINDOW_MS
  )
    return null;
  return snap.ref;
}

/**
 * Saves (or updates) the estimate a visitor is looking at. Called quietly by the
 * Get Quote drawer a few seconds after they stop changing options.
 */
export async function saveQuoteEstimate(
  rawSelection: unknown,
  quoteId?: string | null,
): Promise<{ ok: true; quoteId: string } | { ok: false }> {
  try {
    const parsed = SelectionSchema.safeParse(rawSelection);
    if (!parsed.success) return { ok: false };
    const fields = quoteFields(parsed.data as QuoteSelection);

    const existing = await updatableQuote(quoteId);
    if (existing) {
      await existing.update({ ...fields, updatedAt: Timestamp.now() });
      return { ok: true, quoteId: existing.id };
    }
    if (!(await underRateLimit('quote', 60, 60 * 60 * 1000)))
      return { ok: false };
    const ref = await quotes().add({
      ...fields,
      email: '',
      status: null,
      createdAt: Timestamp.now(),
    });
    return { ok: true, quoteId: ref.id };
  } catch (error) {
    console.error('[Quotes] Could not save estimate:', error);
    return { ok: false };
  }
}

/**
 * "Email me this quote": saves the visitor's email with the estimate (a lead for
 * the shop), tells the owner, and emails the customer when customer emails are set up.
 */
export async function emailMeQuote(input: {
  selection: unknown;
  quoteId?: string | null;
  email: string;
  website?: string;
  elapsedMs?: number;
}): Promise<
  | { ok: true; quoteId: string | null; emailSent: boolean }
  | { ok: false; error: string }
> {
  try {
    // Spam protection, same as the booking form.
    if (
      (input.website ?? '').trim() !== '' ||
      (input.elapsedMs ?? 99999) < 2500
    ) {
      return { ok: true, quoteId: null, emailSent: true };
    }
    const email = String(input.email ?? '')
      .trim()
      .toLowerCase();
    if (!validEmail(email))
      return { ok: false, error: 'Please enter a valid email address.' };
    const parsed = SelectionSchema.safeParse(input.selection);
    if (!parsed.success)
      return {
        ok: false,
        error: 'Please choose your vehicle and service first.',
      };
    if (!(await underRateLimit('quote-email', 10, 60 * 60 * 1000))) {
      return {
        ok: false,
        error: 'Too many requests. Please try again later or give us a call.',
      };
    }

    const fields = quoteFields(parsed.data as QuoteSelection);
    const lead = {
      ...fields,
      email,
      status: 'new',
      contactRequestedAt: Timestamp.now(),
    };
    const existing = await updatableQuote(input.quoteId);
    let quoteId: string;
    if (existing) {
      await existing.update(lead);
      quoteId = existing.id;
    } else {
      quoteId = (await quotes().add({ ...lead, createdAt: Timestamp.now() }))
        .id;
    }

    const priceText = formatPriceRange([fields.priceLow, fields.priceHigh]);

    // Tell the owner right away (works without a verified domain).
    if (process.env.RESEND_API_KEY && process.env.MY_EMAIL) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const e = (v: string) =>
          v.replace(
            /[&<>"']/g,
            (c) =>
              ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
              })[c]!,
          );
        await resend.emails.send({
          from: 'Tint Car Appointment <onboarding@resend.dev>',
          to: [process.env.MY_EMAIL],
          replyTo: email,
          subject: `New quote request: ${fields.vehicleType} ${fields.service} ${priceText}`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;">
            <h2 style="color:#2563eb;margin-top:0;">New quote request</h2>
            <p><strong>Email:</strong> <a href="mailto:${e(email)}">${e(email)}</a></p>
            <p><strong>Vehicle:</strong> ${e(fields.vehicleType)}<br>
            <strong>Service:</strong> ${e(fields.service)}<br>
            <strong>Options:</strong> ${e(fields.summary)}<br>
            <strong>Estimate shown:</strong> ${e(priceText)}</p>
            <p style="color:#64748b;font-size:12px;">Reply to this email to answer the customer. You'll also find it under Quotes in your admin page.</p>
          </div>`,
        });
      } catch (error) {
        console.error('[Quotes] Owner alert failed:', error);
      }
    }

    const sent = await sendQuoteEmail(email, {
      vehicleType: fields.vehicleType,
      service: fields.service,
      summary: fields.summary,
      priceText,
    });
    return { ok: true, quoteId, emailSent: sent.emailSent };
  } catch (error) {
    console.error('[Quotes] Email-me request failed:', error);
    return {
      ok: false,
      error: 'Something went wrong. Please try again or give us a call.',
    };
  }
}
