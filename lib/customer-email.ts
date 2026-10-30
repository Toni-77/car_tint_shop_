// Emails sent to customers from the admin page (confirmations and new times).
// Sending to customers needs a domain verified in Resend, set as BOOKING_FROM_EMAIL,
// e.g. BOOKING_FROM_EMAIL="Supernova Tinting <bookings@your-domain.com>".
import { Resend } from 'resend';
import { formatDisplayDate } from '@/lib/booking-rules';
import { SHOP } from '@/lib/shop-info';

export type CustomerEmailKind = 'confirmed' | 'rescheduled';

export type CustomerEmailBooking = {
  firstName: string;
  email: string;
  service: string;
  date: string;
  timeSlot: string;
  vehicle: { year?: string; make?: string; model?: string };
};

export type EmailResult = { emailSent: boolean; emailError?: string };

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

export async function sendCustomerEmail(
  kind: CustomerEmailKind,
  booking: CustomerEmailBooking,
): Promise<EmailResult> {
  const from = process.env.BOOKING_FROM_EMAIL?.trim();
  if (!from || !process.env.RESEND_API_KEY) {
    return {
      emailSent: false,
      emailError:
        'Customer emails are not set up yet: verify your domain in Resend and set BOOKING_FROM_EMAIL.',
    };
  }
  if (!booking.email) {
    return {
      emailSent: false,
      emailError: 'This booking has no customer email.',
    };
  }

  const e = escapeHtml;
  const when = `${formatDisplayDate(booking.date)} at ${booking.timeSlot}`;
  const vehicle = [
    booking.vehicle.year,
    booking.vehicle.make,
    booking.vehicle.model,
  ]
    .filter(Boolean)
    .join(' ');
  const heading =
    kind === 'confirmed'
      ? 'Your appointment is confirmed'
      : 'Your appointment has a new time';
  const subject =
    kind === 'confirmed'
      ? `Confirmed: ${SHOP.name}, ${when}`
      : `New time: ${SHOP.name}, ${when}`;

  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:6px 0;color:#64748b;width:35%;"><strong>${label}:</strong></td><td style="padding:6px 0;color:#0f172a;">${value}</td></tr>`
      : '';

  const html = `
    <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; max-width: 600px; color: #1e293b;">
      <h2 style="color:#dc2626;margin-top:0;font-size:20px;border-bottom:2px solid #f1f5f9;padding-bottom:12px;">${heading}</h2>
      <p style="font-size:15px;">Hi ${e(booking.firstName)},</p>
      <p style="font-size:15px;">${
        kind === 'confirmed'
          ? `Thanks for choosing ${e(SHOP.name)}. We'll see you on <strong>${e(when)}</strong>.`
          : `Your appointment at ${e(SHOP.name)} is now on <strong>${e(when)}</strong>.`
      }</p>
      <table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:14px;">
        ${row('Service', e(booking.service))}
        ${row('Vehicle', e(vehicle))}
        ${row('Address', e(SHOP.address))}
      </table>
      <p style="font-size:14px;margin-top:16px;">Please arrive a few minutes early with your car washed if possible.
      Need to change your time? Call or text us at <a href="tel:${e(SHOP.phone)}" style="color:#dc2626;">${e(SHOP.phone)}</a>.</p>
      <p style="font-size:14px;margin-bottom:0;">See you soon,<br>${e(SHOP.name)}</p>
    </div>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from,
      to: [booking.email],
      replyTo: process.env.MY_EMAIL || undefined,
      subject,
      html,
    });
    if (error) return { emailSent: false, emailError: error.message };
    return { emailSent: true };
  } catch (error) {
    return {
      emailSent: false,
      emailError:
        error instanceof Error ? error.message : 'Email could not be sent.',
    };
  }
}

/** Emails a customer the estimate they asked for on the Get Quote form. */
export async function sendQuoteEmail(
  email: string,
  quote: {
    vehicleType: string;
    service: string;
    summary: string;
    priceText: string;
  },
): Promise<EmailResult> {
  const from = process.env.BOOKING_FROM_EMAIL?.trim();
  if (!from || !process.env.RESEND_API_KEY) {
    return {
      emailSent: false,
      emailError: 'Customer emails are not set up yet.',
    };
  }
  const e = escapeHtml;
  const html = `
    <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; max-width: 600px; color: #1e293b;">
      <h2 style="color:#dc2626;margin-top:0;font-size:20px;border-bottom:2px solid #f1f5f9;padding-bottom:12px;">Your estimate from ${e(SHOP.name)}</h2>
      <p style="font-size:15px;">Thanks for checking prices with us. Here's the estimate you put together:</p>
      <table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;width:35%;"><strong>Vehicle:</strong></td><td style="padding:6px 0;">${e(quote.vehicleType)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;"><strong>Service:</strong></td><td style="padding:6px 0;">${e(quote.service)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;"><strong>Options:</strong></td><td style="padding:6px 0;">${e(quote.summary)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;"><strong>Estimated price:</strong></td><td style="padding:6px 0;font-size:18px;font-weight:bold;">${e(quote.priceText)}</td></tr>
      </table>
      <p style="font-size:13px;color:#64748b;">This is an estimate. Your final price depends on your exact vehicle and we'll confirm it before any work starts.</p>
      <p style="font-size:14px;">Ready to book, or have a question? Call or text us at <a href="tel:${e(SHOP.phone)}" style="color:#dc2626;">${e(SHOP.phone)}</a>${
        SHOP.website
          ? ` or book online at <a href="${e(SHOP.website)}" style="color:#dc2626;">${e(SHOP.website)}</a>`
          : ''
      }.</p>
      <p style="font-size:14px;margin-bottom:0;">${e(SHOP.name)}</p>
    </div>`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from,
      to: [email],
      replyTo: process.env.MY_EMAIL || undefined,
      subject: `Your ${quote.service} estimate: ${quote.priceText}`,
      html,
    });
    if (error) return { emailSent: false, emailError: error.message };
    return { emailSent: true };
  } catch (error) {
    return {
      emailSent: false,
      emailError:
        error instanceof Error ? error.message : 'Email could not be sent.',
    };
  }
}
