'use client';

import { createContext, useContext } from 'react';
import type {
  ActionResult,
  AdminBookingPrefill,
  BookingStatus,
} from '@/lib/admin-types';
import { STATUS_LABELS } from '@/lib/admin-types';

// Shared look for the admin page (matches the booking drawer's dark slate theme).
export const ui = {
  card: 'rounded-xl border border-white/10 bg-slate-800',
  input:
    'w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 lg:text-[15px]',
  label: 'mb-1 block text-sm font-medium text-slate-300',
  button:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50',
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50',
  chip: (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      active
        ? 'border-red-500 bg-red-600 text-white'
        : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white'
    }`,
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  requested: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  confirmed: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  completed: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  cancelled: 'border-slate-500/50 bg-slate-500/10 text-slate-400',
  'no-show': 'border-red-400/40 bg-red-400/10 text-red-200',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Formats digits as (312) 555-0123 while typing, max 10 digits. */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** "2026-11-04" -> "Wed, Nov 4" */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export type Tone = 'success' | 'error' | 'warning';

export type AdminContextValue = {
  /** Shows a short message at the top of the admin page. */
  notify: (message: string, tone?: Tone) => void;
  /** Calls an admin server action with the sign-in token; shows errors. */
  call: <T>(
    action: (token: string) => Promise<ActionResult<T>>,
  ) => Promise<ActionResult<T>>;
  /** Opens a booking on the Bookings screen. */
  openBooking: (id: string) => void;
  /** Opens Add booking with a date and time already chosen. */
  startBooking: (date: string, time: string) => void;
  /** Opens Add booking with customer, vehicle or quote details filled in. */
  prefillBooking: (prefill: AdminBookingPrefill) => void;
  /** Opens a customer on the Customers screen. */
  openCustomer: (key: string) => void;
  /** Number of quote requests marked New (shown on the Quotes tab). */
  newQuotes: number;
  refreshNewQuotes: () => void;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside the admin page');
  return value;
}

/** Shows the result of an email that was sent (or not) with an action. */
export function notifyEmail(
  notify: AdminContextValue['notify'],
  result: { emailSent?: boolean; emailError?: string },
  done: string,
) {
  if (result.emailSent)
    notify(`${done} Email sent to the customer.`, 'success');
  else if (result.emailError)
    notify(`${done} The email was not sent: ${result.emailError}`, 'warning');
  else notify(done, 'success');
}

/** Downloads CSV text as a spreadsheet file (opens in Excel or Google Sheets). */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
