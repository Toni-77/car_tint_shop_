'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminCreateBooking, adminOpenTimes } from '@/actions/admin';
import {
  FILM_REMOVAL_OPTIONS,
  NOTES_MAX_LENGTH,
  SERVICES,
  TINT_SHADES,
  TINT_WINDOWS,
  VEHICLE_TYPES,
  formatDisplayDate,
  normalizeUSPhone,
  shopNow,
} from '@/lib/booking-rules';
import type { AdminBookingPrefill, NewBookingInput } from '@/lib/admin-types';
import { formatPhoneInput, notifyEmail, ui, useAdmin } from './ui';

type Form = Required<NewBookingInput>;

const emptyForm = (date = ''): Form => ({
  vehicleType: '',
  year: '',
  make: '',
  model: '',
  service: '',
  tintShade: '',
  tintWindows: [],
  filmRemoval: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  date,
  timeSlot: '',
  notes: '',
  status: 'confirmed',
  sendEmail: false,
  quoteId: '',
});

interface AddBookingScreenProps {
  /** Details to fill in: a time picked on the Calendar, a quote, or a customer. */
  start: AdminBookingPrefill | null;
  onStarted: () => void;
}

export default function AddBookingScreen({
  start,
  onStarted,
}: AddBookingScreenProps) {
  const { call, notify, openBooking } = useAdmin();
  const today = shopNow().date;
  const [form, setForm] = useState<Form>(() => emptyForm(today));
  const [times, setTimes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [presetTime, setPresetTime] = useState('');

  // Fill in what was sent over from the Calendar, a quote or a customer.
  useEffect(() => {
    if (!start) return;
    const { date, timeSlot, ...details } = start;
    setForm((f) => {
      const nextDate = date ?? f.date;
      // Same date as already shown: the open times are loaded, so pick the time now.
      const sameDay =
        nextDate === f.date && !!timeSlot && !!times?.includes(timeSlot);
      return {
        ...(details.firstName || details.phone || details.quoteId
          ? emptyForm(nextDate)
          : f),
        ...Object.fromEntries(
          Object.entries(details).filter(([, v]) => v !== undefined),
        ),
        date: nextDate,
        timeSlot: sameDay ? timeSlot! : '',
      };
    });
    setPresetTime(timeSlot ?? '');
    setError('');
    onStarted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, onStarted]);

  // Load the open times whenever the date changes.
  useEffect(() => {
    if (!form.date) {
      setTimes([]);
      return;
    }
    let active = true;
    setTimes(null);
    call((token) => adminOpenTimes(token, form.date)).then((result) => {
      if (!active) return;
      const open = result.ok ? result.data : [];
      setTimes(open);
      if (presetTime && open.includes(presetTime)) {
        setForm((f) => ({ ...f, timeSlot: presetTime }));
      }
      setPresetTime('');
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, call]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 40 }, (_, i) => String(current + 1 - i));
  }, []);

  const isTint = form.service === 'Window Tint';
  const canEmail = form.status === 'confirmed' && form.email.trim() !== '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizeUSPhone(form.phone)) {
      setError('Enter a 10-digit US phone number.');
      return;
    }
    if (!form.timeSlot) {
      setError('Choose a time.');
      return;
    }
    setBusy(true);
    const input: NewBookingInput = {
      ...form,
      tintShade: isTint && form.tintShade ? form.tintShade : undefined,
      tintWindows: isTint ? form.tintWindows : [],
      filmRemoval: isTint && form.filmRemoval ? form.filmRemoval : undefined,
      sendEmail: canEmail && form.sendEmail,
      quoteId: form.quoteId || undefined,
    };
    const result = await call((token) => adminCreateBooking(token, input));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      // The time may have just been taken; refresh the open times.
      if (/time/i.test(result.error)) {
        const fresh = await call((token) => adminOpenTimes(token, form.date));
        if (fresh.ok) setTimes(fresh.data);
        setForm((f) => ({ ...f, timeSlot: '' })); // keeps the error message visible
      }
      return;
    }
    const done = `Booked ${form.firstName} for ${formatDisplayDate(form.date)} at ${form.timeSlot}.`;
    if (input.sendEmail) notifyEmail(notify, result, done);
    else notify(done, 'success');
    setForm(emptyForm(form.date));
    openBooking(result.data.id);
  };

  const section = 'space-y-4 p-4 lg:p-5';
  const heading = 'text-base font-bold text-white lg:text-lg';

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Add a booking</h2>
        <p className="text-sm text-slate-400">
          For phone calls and walk-ins. Only open times are shown, so the
          website can't double-book it.
        </p>
      </div>

      {form.quoteId && (
        <p className="rounded-lg border border-sky-400/40 bg-sky-400/10 p-3 text-sm text-sky-100">
          This booking will be linked to the customer&apos;s quote and mark it
          as booked.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <section className={`${ui.card} ${section}`}>
        <h3 className={heading}>Appointment</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ab-date" className={ui.label}>
              Date
            </label>
            <input
              id="ab-date"
              type="date"
              required
              min={today}
              className={ui.input}
              value={form.date}
              onChange={(e) => {
                set('date', e.target.value);
                set('timeSlot', '');
              }}
            />
            {form.date && (
              <p className="mt-1 text-xs text-slate-400">
                {formatDisplayDate(form.date)}
              </p>
            )}
          </div>
          <fieldset>
            <legend className={ui.label}>Status</legend>
            <div className="flex gap-2">
              {(['confirmed', 'requested'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={form.status === status}
                  className={ui.chip(form.status === status)}
                  onClick={() => set('status', status)}
                >
                  {status === 'confirmed' ? 'Confirmed' : 'Requested'}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div>
          <p className={ui.label}>Time</p>
          {times === null ? (
            <p className="text-sm text-slate-400">Checking open times...</p>
          ) : times.length === 0 ? (
            <p className="text-sm text-amber-200">
              No open times on this date (closed, fully booked, or blocked).
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {times.map((time) => (
                <button
                  key={time}
                  type="button"
                  aria-pressed={form.timeSlot === time}
                  onClick={() => set('timeSlot', time)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    form.timeSlot === time
                      ? 'border-red-500 bg-red-600 text-white'
                      : 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${ui.card} ${section}`}>
        <h3 className={heading}>Customer</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ab-first" className={ui.label}>
              First name
            </label>
            <input
              id="ab-first"
              required
              maxLength={50}
              className={ui.input}
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ab-last" className={ui.label}>
              Last name
            </label>
            <input
              id="ab-last"
              required
              maxLength={50}
              className={ui.input}
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ab-phone" className={ui.label}>
              Phone
            </label>
            <input
              id="ab-phone"
              type="tel"
              inputMode="numeric"
              required
              className={ui.input}
              placeholder="(312) 555-0123"
              value={form.phone}
              onChange={(e) => set('phone', formatPhoneInput(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="ab-email" className={ui.label}>
              Email{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="ab-email"
              type="email"
              maxLength={254}
              className={ui.input}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className={`${ui.card} ${section}`}>
        <h3 className={heading}>Vehicle and service</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ab-type" className={ui.label}>
              Vehicle type
            </label>
            <select
              id="ab-type"
              required
              className={ui.input}
              value={form.vehicleType}
              onChange={(e) => set('vehicleType', e.target.value)}
            >
              <option value="">Select</option>
              {VEHICLE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ab-year" className={ui.label}>
              Year
            </label>
            <select
              id="ab-year"
              required
              className={ui.input}
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
            >
              <option value="">Select</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ab-make" className={ui.label}>
              Make
            </label>
            <input
              id="ab-make"
              required
              maxLength={50}
              className={ui.input}
              placeholder="Toyota"
              value={form.make}
              onChange={(e) => set('make', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ab-model" className={ui.label}>
              Model
            </label>
            <input
              id="ab-model"
              required
              maxLength={50}
              className={ui.input}
              placeholder="Camry"
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ab-service" className={ui.label}>
              Service
            </label>
            <select
              id="ab-service"
              required
              className={ui.input}
              value={form.service}
              onChange={(e) => set('service', e.target.value)}
            >
              <option value="">Select</option>
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {isTint && (
          <div className="space-y-4 rounded-lg border border-white/10 bg-slate-900/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ab-shade" className={ui.label}>
                  Tint shade
                </label>
                <select
                  id="ab-shade"
                  className={ui.input}
                  value={form.tintShade}
                  onChange={(e) => set('tintShade', e.target.value)}
                >
                  <option value="">Not decided</option>
                  {TINT_SHADES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ab-removal" className={ui.label}>
                  Remove old film?
                </label>
                <select
                  id="ab-removal"
                  className={ui.input}
                  value={form.filmRemoval}
                  onChange={(e) => set('filmRemoval', e.target.value)}
                >
                  <option value="">Not asked</option>
                  {FILM_REMOVAL_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset>
              <legend className={ui.label}>Windows</legend>
              <div className="flex flex-wrap gap-2">
                {TINT_WINDOWS.map((w) => {
                  const on = form.tintWindows.includes(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      className={ui.chip(on)}
                      onClick={() =>
                        set(
                          'tintWindows',
                          on
                            ? form.tintWindows.filter((x) => x !== w)
                            : [...form.tintWindows, w],
                        )
                      }
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        <div>
          <label htmlFor="ab-notes" className={ui.label}>
            Notes{' '}
            <span className="font-normal text-slate-500">
              (saved with the booking)
            </span>
          </label>
          <textarea
            id="ab-notes"
            rows={3}
            maxLength={NOTES_MAX_LENGTH}
            className={`${ui.input} resize-y`}
            placeholder="Quoted $480 on the phone"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </section>

      <div className={`${ui.card} flex flex-wrap items-center gap-4 p-4`}>
        <label
          className={`flex items-center gap-2 text-sm ${canEmail ? 'text-slate-200' : 'text-slate-500'}`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-red-600"
            disabled={!canEmail}
            checked={canEmail && form.sendEmail}
            onChange={(e) => set('sendEmail', e.target.checked)}
          />
          Email a confirmation to the customer
          {!canEmail && (
            <span className="text-xs">
              (
              {form.status === 'confirmed'
                ? 'add an email first'
                : 'only for confirmed bookings'}
              )
            </span>
          )}
        </label>
        <button
          type="submit"
          disabled={busy}
          className={`${ui.primary} ml-auto px-6 py-3`}
        >
          {busy ? 'Saving...' : 'Save booking'}
        </button>
      </div>
    </form>
  );
}
