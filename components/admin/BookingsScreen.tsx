'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import {
  adminExportCsv,
  adminGetBooking,
  adminHoldOlderBookings,
  adminListBookings,
} from '@/actions/admin';
import {
  addDays,
  shopNow,
  slotToMinutes,
  startOfWeek,
} from '@/lib/booking-rules';
import {
  BOOKING_STATUSES,
  STATUS_LABELS,
  type AdminBooking,
  type BookingStatus,
} from '@/lib/admin-types';
import { StatusBadge, shortDate, ui, useAdmin } from './ui';
import BookingDetail from './BookingDetail';

// The list covers the last 60 days and the next 6 months.
const PAST_DAYS = 60;
const FUTURE_DAYS = 183;

type View = 'upcoming' | 'past';

interface BookingsScreenProps {
  /** A booking to open right away (e.g. clicked on the Calendar). */
  openId: string | null;
  onOpened: () => void;
}

export default function BookingsScreen({
  openId,
  onOpened,
}: BookingsScreenProps) {
  const { call, notify } = useAdmin();
  const today = shopNow().date;

  const [list, setList] = useState<AdminBooking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('upcoming');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>(
    'all',
  );
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState(addDays(today, -30));
  const [exportTo, setExportTo] = useState(today);

  const load = useCallback(async () => {
    setLoading(true);
    // Make sure older bookings hold their times (quick, and does nothing once done).
    await call((token) => adminHoldOlderBookings(token));
    const result = await call((token) =>
      adminListBookings(
        token,
        addDays(today, -PAST_DAYS),
        addDays(today, FUTURE_DAYS),
      ),
    );
    setLoading(false);
    if (result.ok) setList(result.data);
  }, [call, today]);

  useEffect(() => {
    void load();
  }, [load]);

  // Open a booking sent over from the Calendar, even if it's outside the list's range.
  useEffect(() => {
    if (!openId || !list) return;
    onOpened();
    setSelectedId(openId);
    if (!list.some((b) => b.id === openId)) {
      call((token) => adminGetBooking(token, openId)).then((result) => {
        if (result.ok) setList((current) => [...(current ?? []), result.data]);
      });
    }
  }, [openId, list, onOpened, call]);

  const replaceBooking = (updated: AdminBooking) => {
    setList((current) =>
      (current ?? []).map((b) => (b.id === updated.id ? updated : b)),
    );
    // If a double-booked time was freed, let the other booking take it over.
    if (
      updated.status === 'cancelled' &&
      doubleBookedRef.current.has(updated.id)
    ) {
      void load();
    }
  };

  const active = (b: AdminBooking) =>
    b.status === 'requested' || b.status === 'confirmed';

  const stats = useMemo(() => {
    const all = list ?? [];
    const weekEnd = addDays(startOfWeek(today), 6);
    return {
      today: all.filter((b) => b.date === today && active(b)).length,
      needsConfirming: all.filter(
        (b) => b.date >= today && b.status === 'requested',
      ).length,
      thisWeek: all.filter(
        (b) => b.date >= today && b.date <= weekEnd && active(b),
      ).length,
      done30: all.filter(
        (b) =>
          b.status === 'completed' &&
          b.date >= addDays(today, -30) &&
          b.date <= today,
      ).length,
    };
  }, [list, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const items = (list ?? []).filter((b) => {
      if (view === 'upcoming' ? b.date < today : b.date >= today) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        b.firstName,
        b.lastName,
        b.email,
        b.vehicle.make,
        b.vehicle.model,
        b.service,
      ]
        .join(' ')
        .toLowerCase();
      return (
        haystack.includes(q) ||
        (digits.length >= 3 && b.phone.replace(/\D/g, '').includes(digits))
      );
    });
    const byTime = (a: AdminBooking, b: AdminBooking) =>
      a.date.localeCompare(b.date) ||
      (slotToMinutes(a.timeSlot) ?? 0) - (slotToMinutes(b.timeSlot) ?? 0);
    items.sort(view === 'upcoming' ? byTime : (a, b) => byTime(b, a));
    const groups: { date: string; items: AdminBooking[] }[] = [];
    for (const b of items) {
      const last = groups[groups.length - 1];
      if (last?.date === b.date) last.items.push(b);
      else groups.push({ date: b.date, items: [b] });
    }
    return groups;
  }, [list, view, statusFilter, query, today]);

  const counts = useMemo(() => {
    const scoped = (list ?? []).filter((b) =>
      view === 'upcoming' ? b.date >= today : b.date < today,
    );
    const result: Record<string, number> = { all: scoped.length };
    for (const s of BOOKING_STATUSES)
      result[s] = scoped.filter((b) => b.status === s).length;
    return result;
  }, [list, view, today]);

  // Upcoming times with more than one active booking (from before time slots existed).
  const doubleBooked = useMemo(() => {
    const byTime = new Map<string, string[]>();
    for (const b of list ?? []) {
      if (!active(b) || b.date < today) continue;
      const key = `${b.date}|${b.timeSlot}`;
      byTime.set(key, [...(byTime.get(key) ?? []), b.id]);
    }
    return new Set([...byTime.values()].filter((ids) => ids.length > 1).flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, today]);

  const doubleBookedRef = useRef(doubleBooked);
  doubleBookedRef.current = doubleBooked;

  const selected = list?.find((b) => b.id === selectedId) ?? null;

  const downloadCsv = async () => {
    if (!exportFrom || !exportTo || exportFrom > exportTo) {
      notify('Choose a start date before the end date.', 'warning');
      return;
    }
    const result = await call((token) =>
      adminExportCsv(token, exportFrom, exportTo),
    );
    if (!result.ok) return;
    const blob = new Blob(['﻿' + result.data], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookings_${exportFrom}_to_${exportTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Spreadsheet downloaded.', 'success');
  };

  const statCards = [
    { label: 'Today', value: stats.today, hint: 'cars booked' },
    {
      label: 'Needs confirming',
      value: stats.needsConfirming,
      hint: 'requests',
      warn: stats.needsConfirming > 0,
    },
    { label: 'This week', value: stats.thisWeek, hint: 'appointments left' },
    {
      label: 'Done, last 30 days',
      value: stats.done30,
      hint: 'jobs completed',
    },
  ];

  const select = (id: string | null) => {
    setSelectedId(id);
    // On phones the booking replaces the list, so start at the top.
    if (typeof window !== 'undefined' && window.innerWidth < 1024)
      window.scrollTo(0, 0);
  };

  return (
    <div className="space-y-5">
      <div className={`space-y-5 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className={`${ui.card} p-4`}>
              <p className="text-sm text-slate-400">{card.label}</p>
              <p
                className={`mt-1 text-3xl font-bold ${card.warn ? 'text-amber-300' : ''}`}
              >
                {list ? card.value : '–'}
              </p>
              <p className="text-xs text-slate-500">{card.hint}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-600 p-0.5">
            {(['upcoming', 'past'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  view === v
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {v === 'upcoming' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className={`${ui.input} pl-9`}
              placeholder="Search name, phone, email or car"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search bookings"
            />
          </div>
          <button
            type="button"
            className={ui.button}
            onClick={() => setExportOpen((o) => !o)}
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            className={ui.button}
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {exportOpen && (
          <div className={`${ui.card} flex flex-wrap items-end gap-3 p-4`}>
            <div>
              <label htmlFor="export-from" className={ui.label}>
                From
              </label>
              <input
                id="export-from"
                type="date"
                className={ui.input}
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="export-to" className={ui.label}>
                To
              </label>
              <input
                id="export-to"
                type="date"
                className={ui.input}
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
              />
            </div>
            <button type="button" className={ui.primary} onClick={downloadCsv}>
              Download spreadsheet
            </button>
            <p className="w-full text-xs text-slate-400">
              Includes every booking with an appointment date in this range.
              Opens in Excel or Google Sheets.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(['all', ...BOOKING_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={ui.chip(statusFilter === s)}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}{' '}
              <span className="opacity-70">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className={selected ? 'hidden lg:block' : ''}>
          {list === null ? (
            <p className="py-10 text-center text-slate-400">
              Loading bookings...
            </p>
          ) : visible.length === 0 ? (
            <div className={`${ui.card} p-8 text-center text-slate-400`}>
              {query || statusFilter !== 'all'
                ? 'No bookings match these filters.'
                : view === 'upcoming'
                  ? 'No upcoming bookings yet.'
                  : 'No bookings in the last 60 days.'}
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((group) => (
                <section key={group.date}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                    {shortDate(group.date)}
                    {group.date === today && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                        Today
                      </span>
                    )}
                  </h3>
                  <ul
                    className={`${ui.card} divide-y divide-white/10 overflow-hidden`}
                  >
                    {group.items.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => select(b.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                            b.id === selectedId
                              ? 'bg-slate-700'
                              : 'hover:bg-slate-700/50'
                          } ${b.status === 'cancelled' ? 'opacity-60' : ''}`}
                        >
                          <span className="w-[72px] shrink-0 text-sm font-semibold tabular-nums lg:text-[15px]">
                            {b.timeSlot}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {b.firstName} {b.lastName}
                            </span>
                            <span className="block truncate text-sm text-slate-400">
                              {[b.vehicle.year, b.vehicle.make, b.vehicle.model]
                                .filter(Boolean)
                                .join(' ')}{' '}
                              · {b.service}
                            </span>
                          </span>
                          {doubleBooked.has(b.id) && (
                            <span className="shrink-0 rounded-full border border-red-400/60 bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-100">
                              Double-booked
                            </span>
                          )}
                          <StatusBadge status={b.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className={selected ? '' : 'hidden lg:block'}>
          <div className="lg:sticky lg:top-24">
            {selected ? (
              <BookingDetail
                booking={selected}
                doubleBooked={doubleBooked.has(selected.id)}
                onChange={replaceBooking}
                onBack={() => select(null)}
              />
            ) : (
              <div className={`${ui.card} p-8 text-center text-slate-400`}>
                Choose a booking to see its details and actions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
