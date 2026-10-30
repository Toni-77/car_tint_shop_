'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import {
  adminAddNote,
  adminOpenTimes,
  adminReschedule,
  adminSetStatus,
} from '@/actions/admin';
import { formatDisplayDate, shopNow } from '@/lib/booking-rules';
import type { AdminBooking, BookingStatus } from '@/lib/admin-types';
import { adminGetCustomer } from '@/actions/admin-crm';
import type { Customer } from '@/lib/admin-types';
import CustomerHistory from './CustomerHistory';
import { StatusBadge, notifyEmail, ui, useAdmin } from './ui';

interface BookingDetailProps {
  booking: AdminBooking;
  /** Another active booking has the same date and time. */
  doubleBooked?: boolean;
  onChange: (booking: AdminBooking) => void;
  onBack: () => void;
}

function formatWhen(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BookingDetail({
  booking,
  doubleBooked = false,
  onChange,
  onBack,
}: BookingDetailProps) {
  const { call, notify, openCustomer } = useAdmin();
  const [customer, setCustomer] = useState<Customer | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BookingStatus | null>(
    null,
  );
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [times, setTimes] = useState<string[] | null>(null);
  const [emailNewTime, setEmailNewTime] = useState(true);
  const [note, setNote] = useState('');

  // Load this customer's other bookings and quotes.
  useEffect(() => {
    let active = true;
    setCustomer(undefined);
    call((token) => adminGetCustomer(token, booking.phone, booking.email)).then(
      (result) => {
        if (active) setCustomer(result.ok ? result.data : null);
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  // Reset the panels when a different booking is opened.
  useEffect(() => {
    setConfirmAction(null);
    setRescheduling(false);
    setNewDate('');
    setNewTime('');
    setTimes(null);
    setNote('');
  }, [booking.id]);

  // Load open times for the reschedule date.
  useEffect(() => {
    if (!rescheduling || !newDate) return;
    let active = true;
    setTimes(null);
    setNewTime('');
    call((token) => adminOpenTimes(token, newDate)).then((result) => {
      if (active) setTimes(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, [rescheduling, newDate, call]);

  const setStatus = async (status: BookingStatus, sendEmail = false) => {
    setBusy(true);
    const result = await call((token) =>
      adminSetStatus(token, booking.id, status, sendEmail),
    );
    setBusy(false);
    setConfirmAction(null);
    if (!result.ok) return;
    onChange(result.data);
    const done =
      status === 'cancelled'
        ? 'Booking cancelled and the time is open again.'
        : status === 'confirmed'
          ? 'Booking confirmed.'
          : status === 'completed'
            ? 'Marked as done.'
            : status === 'no-show'
              ? 'Marked as a no-show.'
              : 'Status updated.';
    if (sendEmail) notifyEmail(notify, result, done);
    else notify(done, 'success');
  };

  const saveReschedule = async () => {
    if (!newDate || !newTime) return;
    setBusy(true);
    const sendEmail = emailNewTime && !!booking.email;
    const result = await call((token) =>
      adminReschedule(token, booking.id, newDate, newTime, sendEmail),
    );
    setBusy(false);
    if (!result.ok) return;
    onChange(result.data);
    setRescheduling(false);
    const done = `Moved to ${formatDisplayDate(newDate)} at ${newTime}.`;
    if (sendEmail) notifyEmail(notify, result, done);
    else notify(done, 'success');
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    const result = await call((token) => adminAddNote(token, booking.id, note));
    setBusy(false);
    if (!result.ok) return;
    onChange(result.data);
    setNote('');
    notify('Note added.', 'success');
  };

  const isOpen =
    booking.status === 'requested' || booking.status === 'confirmed';
  const vehicle = [
    booking.vehicle.year,
    booking.vehicle.make,
    booking.vehicle.model,
  ]
    .filter(Boolean)
    .join(' ');

  const confirmCopy: Partial<
    Record<BookingStatus, { ask: string; yes: string }>
  > = {
    cancelled: {
      ask: 'Cancel this booking? The time opens up for other customers.',
      yes: 'Yes, cancel',
    },
    'no-show': { ask: 'Mark this customer as a no-show?', yes: 'Yes, no-show' },
  };

  return (
    <div className={`${ui.card} space-y-5 p-4 lg:p-5`}>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> All bookings
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">
            {booking.firstName} {booking.lastName}
          </h2>
          <p className="mt-0.5 text-sm text-slate-300 lg:text-[15px]">
            {formatDisplayDate(booking.date)} at {booking.timeSlot}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {doubleBooked && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/50 bg-red-500/15 p-3 text-sm text-red-100"
        >
          Another booking has this same time (it was made before double-booking
          protection existed). Reschedule or cancel one of them.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {booking.phone && (
          <a href={`tel:${booking.phone}`} className={ui.button}>
            <Phone className="h-4 w-4 text-red-400" /> {booking.phone}
          </a>
        )}
        {booking.email && (
          <a
            href={`mailto:${booking.email}`}
            className={`${ui.button} max-w-full`}
          >
            <Mail className="h-4 w-4 shrink-0 text-red-400" />
            <span className="truncate">{booking.email}</span>
          </a>
        )}
      </div>

      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm lg:text-[15px]">
        <dt className="text-slate-400">Vehicle</dt>
        <dd>
          {vehicle || '—'}
          {booking.vehicle.type && (
            <span className="text-slate-400"> · {booking.vehicle.type}</span>
          )}
        </dd>
        <dt className="text-slate-400">Service</dt>
        <dd>{booking.service || '—'}</dd>
        {booking.tint && (
          <>
            <dt className="text-slate-400">Tint shade</dt>
            <dd>{booking.tint.shade || '—'}</dd>
            <dt className="text-slate-400">Windows</dt>
            <dd>{booking.tint.windows.join(', ') || '—'}</dd>
            <dt className="text-slate-400">Old film</dt>
            <dd>
              {booking.tint.removeOldFilm
                ? `Remove: ${booking.tint.removeOldFilm}`
                : '—'}
            </dd>
          </>
        )}
        {booking.notes && (
          <>
            <dt className="text-slate-400">Customer note</dt>
            <dd className="whitespace-pre-wrap">{booking.notes}</dd>
          </>
        )}
        <dt className="text-slate-400">Booked</dt>
        <dd>
          {formatWhen(booking.createdAt) || '—'}{' '}
          <span className="text-slate-400">
            · {booking.source === 'admin' ? 'added by you' : 'website'}
          </span>
        </dd>
      </dl>

      {/* Actions */}
      <div className="space-y-3 border-t border-white/10 pt-4">
        {confirmAction && confirmCopy[confirmAction] ? (
          <div className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
            <p className="text-sm text-red-100">
              {confirmCopy[confirmAction]!.ask}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={ui.primary}
                onClick={() => setStatus(confirmAction)}
              >
                {confirmCopy[confirmAction]!.yes}
              </button>
              <button
                type="button"
                className={ui.button}
                onClick={() => setConfirmAction(null)}
              >
                Keep booking
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {booking.status === 'requested' && (
              <>
                {booking.email && (
                  <button
                    type="button"
                    disabled={busy}
                    className={ui.primary}
                    onClick={() => setStatus('confirmed', true)}
                  >
                    Confirm and send email
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  className={booking.email ? ui.button : ui.primary}
                  onClick={() => setStatus('confirmed')}
                >
                  {booking.email ? 'Confirm only' : 'Confirm'}
                </button>
              </>
            )}
            {booking.status === 'confirmed' && (
              <button
                type="button"
                disabled={busy}
                className={ui.primary}
                onClick={() => setStatus('completed')}
              >
                Mark done
              </button>
            )}
            {isOpen && (
              <button
                type="button"
                disabled={busy}
                className={ui.button}
                onClick={() => {
                  setRescheduling((value) => !value);
                  setNewDate(
                    booking.date >= shopNow().date
                      ? booking.date
                      : shopNow().date,
                  );
                }}
              >
                Reschedule
              </button>
            )}
            {booking.status === 'confirmed' && (
              <button
                type="button"
                disabled={busy}
                className={ui.button}
                onClick={() => setConfirmAction('no-show')}
              >
                No-show
              </button>
            )}
            {isOpen && (
              <button
                type="button"
                disabled={busy}
                className={ui.danger}
                onClick={() => setConfirmAction('cancelled')}
              >
                Cancel booking
              </button>
            )}
            {(booking.status === 'completed' ||
              booking.status === 'no-show') && (
              <button
                type="button"
                disabled={busy}
                className={ui.button}
                onClick={() => setStatus('confirmed')}
              >
                Undo (back to confirmed)
              </button>
            )}
            {booking.status === 'cancelled' && (
              <p className="text-sm text-slate-400">
                This booking was cancelled and its time is open again. To book
                this customer again, use Add booking.
              </p>
            )}
          </div>
        )}

        {rescheduling && isOpen && (
          <div className="space-y-3 rounded-lg border border-white/10 bg-slate-900/60 p-3">
            <p className="text-sm font-semibold">Choose a new time</p>
            <input
              type="date"
              className={ui.input}
              min={shopNow().date}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              aria-label="New date"
            />
            {times === null ? (
              <p className="text-sm text-slate-400">Checking open times...</p>
            ) : times.length === 0 ? (
              <p className="text-sm text-amber-200">
                No open times on this date.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    aria-pressed={newTime === time}
                    onClick={() => setNewTime(time)}
                    className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                      newTime === time
                        ? 'border-red-500 bg-red-600 text-white'
                        : 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
            {booking.email && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={emailNewTime}
                  onChange={(e) => setEmailNewTime(e.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                Email the customer the new time
              </label>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !newTime}
                className={ui.primary}
                onClick={saveReschedule}
              >
                Save new time
              </button>
              <button
                type="button"
                className={ui.button}
                onClick={() => setRescheduling(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* This customer's history */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            This customer
          </h3>
          {customer && (
            <button
              type="button"
              className="text-sm font-semibold text-red-300 hover:text-red-200"
              onClick={() => openCustomer(customer.key)}
            >
              Open customer
            </button>
          )}
        </div>
        {customer === undefined ? (
          <p className="text-sm text-slate-500">Loading history...</p>
        ) : customer === null ? (
          <p className="text-sm text-slate-500">No history found.</p>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              {customer.completed} completed visit
              {customer.completed === 1 ? '' : 's'} · {customer.bookings}{' '}
              booking{customer.bookings === 1 ? '' : 's'}
              {customer.noShows > 0 && (
                <span className="text-red-300">
                  {' '}
                  · {customer.noShows} no-show
                  {customer.noShows === 1 ? '' : 's'}
                </span>
              )}
              {customer.quotes > 0 &&
                ` · ${customer.quotes} quote${customer.quotes === 1 ? '' : 's'}`}
            </p>
            {customer.note && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-sm text-amber-100">
                {customer.note}
              </p>
            )}
            <CustomerHistory
              customer={customer}
              excludeBookingId={booking.id}
            />
          </>
        )}
      </div>

      {/* Private notes */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Your notes
        </h3>
        {booking.adminNotes.length === 0 && (
          <p className="text-sm text-slate-500">
            Only you can see notes added here.
          </p>
        )}
        <ul className="space-y-2">
          {booking.adminNotes.map((n) => (
            <li key={n.at} className="rounded-lg bg-slate-900/60 p-2.5 text-sm">
              <p className="whitespace-pre-wrap">{n.text}</p>
              <p className="mt-1 text-xs text-slate-500">{formatWhen(n.at)}</p>
            </li>
          ))}
        </ul>
        <textarea
          rows={2}
          className={`${ui.input} resize-y`}
          placeholder="Called, left a voicemail"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="New note"
        />
        <button
          type="button"
          disabled={busy || !note.trim()}
          className={ui.button}
          onClick={addNote}
        >
          Add note
        </button>
      </div>

      {/* History */}
      {booking.history.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            History
          </h3>
          <ol className="space-y-1.5 text-sm">
            {[...booking.history].reverse().map((h) => (
              <li key={h.at + h.action} className="flex gap-3">
                <span className="w-28 shrink-0 text-slate-500">
                  {formatWhen(h.at)}
                </span>
                <span className="text-slate-300">{h.action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
