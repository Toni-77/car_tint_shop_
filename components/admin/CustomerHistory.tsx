'use client';

import type { Customer } from '@/lib/admin-types';
import { shortDate, useAdmin } from './ui';

interface CustomerHistoryProps {
  customer: Customer;
  /** Leave out this booking (when shown under that booking). */
  excludeBookingId?: string;
}

const STATUS_COLOR: Record<string, string> = {
  Completed: 'text-sky-300',
  Confirmed: 'text-emerald-300',
  Requested: 'text-amber-300',
  'No-show': 'text-red-300',
  Cancelled: 'text-slate-500',
  New: 'text-amber-300',
  Booked: 'text-emerald-300',
};

/** A customer's bookings and quotes, newest first. Bookings open on click. */
export default function CustomerHistory({
  customer,
  excludeBookingId,
}: CustomerHistoryProps) {
  const { openBooking } = useAdmin();
  const items = customer.history.filter(
    (h) => !(h.kind === 'booking' && h.id === excludeBookingId),
  );
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">No other bookings or quotes yet.</p>
    );
  }
  return (
    <ol className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
      {items.map((h) => {
        const body = (
          <>
            <span className="w-24 shrink-0 text-sm text-slate-400">
              {h.date ? shortDate(h.date) : '—'}
              {h.time && <span className="block text-xs">{h.time}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{h.title}</span>
              <span className="block truncate text-xs text-slate-400">
                {h.detail}
              </span>
            </span>
            <span
              className={`shrink-0 text-xs font-semibold ${STATUS_COLOR[h.status] ?? 'text-slate-400'}`}
            >
              {h.status}
            </span>
          </>
        );
        return (
          <li key={`${h.kind}-${h.id}`}>
            {h.kind === 'booking' ? (
              <button
                type="button"
                onClick={() => openBooking(h.id)}
                className="flex w-full items-center gap-3 bg-slate-900/40 px-3 py-2.5 text-left hover:bg-slate-700/50"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-slate-900/20 px-3 py-2.5">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
