'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import {
  adminBlockTimes,
  adminGetCalendar,
  adminUnblockTimes,
} from '@/actions/admin';
import {
  addDays,
  getOpeningSlots,
  isHoliday,
  shopNow,
  slotId,
  slotToMinutes,
  startOfWeek,
} from '@/lib/booking-rules';
import type { AdminBooking, CalendarSlot } from '@/lib/admin-types';
import { StatusBadge, shortDate, ui, useAdmin } from './ui';

// Monday to Saturday (the shop is closed Sundays).
const DAYS_SHOWN = 6;

type Cell =
  | { kind: 'closed' }
  | { kind: 'past' }
  | { kind: 'open'; id: string }
  | { kind: 'blocked'; id: string; reason: string }
  | { kind: 'booking'; id: string; booking: AdminBooking | null };

export default function CalendarScreen() {
  const { call, notify, openBooking, startBooking } = useAdmin();
  const now = shopNow();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now.date));
  const [data, setData] = useState<{
    bookings: AdminBooking[];
    slots: CalendarSlot[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedOpen, setSelectedOpen] = useState<string[]>([]); // slot ids
  const [selectedBlocked, setSelectedBlocked] = useState<string[]>([]); // slot ids
  const [reason, setReason] = useState('');
  const [mobileDay, setMobileDay] = useState(0);

  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const load = useCallback(async () => {
    const result = await call((token) =>
      adminGetCalendar(token, weekStart, addDays(weekStart, DAYS_SHOWN - 1)),
    );
    if (result.ok) setData(result.data);
  }, [call, weekStart]);

  useEffect(() => {
    setData(null);
    setSelectedOpen([]);
    setSelectedBlocked([]);
    void load();
  }, [load]);

  // On phones, start on today's column if it's in this week.
  useEffect(() => {
    const index = days.indexOf(now.date);
    setMobileDay(index >= 0 ? index : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // Every time row shown: the union of the week's opening times, in order.
  const rows = useMemo(() => {
    const all = new Set<string>();
    for (const day of days) getOpeningSlots(day).forEach((s) => all.add(s));
    return [...all].sort(
      (a, b) => (slotToMinutes(a) ?? 0) - (slotToMinutes(b) ?? 0),
    );
  }, [days]);

  const cellFor = useCallback(
    (date: string, time: string): Cell => {
      if (!getOpeningSlots(date).includes(time)) return { kind: 'closed' };
      const id = slotId(date, time);
      const slot = data?.slots.find((s) => s.id === id);
      if (slot?.kind === 'block')
        return { kind: 'blocked', id, reason: slot.reason ?? '' };
      if (slot) {
        const booking =
          data?.bookings.find((b) => b.id === slot.bookingId) ?? null;
        return { kind: 'booking', id, booking };
      }
      const past =
        date < now.date ||
        (date === now.date && (slotToMinutes(time) ?? 0) <= now.minutes);
      return past ? { kind: 'past' } : { kind: 'open', id };
    },
    [data, now.date, now.minutes],
  );

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const block = async (
    date: string,
    times: string[] | 'whole-day',
    blockReason: string = reason,
  ) => {
    setBusy(true);
    const result = await call((token) =>
      adminBlockTimes(token, date, times, blockReason),
    );
    setBusy(false);
    if (!result.ok) return;
    const { blocked, skipped } = result.data;
    notify(
      `Blocked ${blocked} time${blocked === 1 ? '' : 's'}${
        skipped ? ` (${skipped} already booked or blocked, left as is)` : ''
      }.`,
      'success',
    );
    setSelectedOpen([]);
    setReason('');
    void load();
  };

  /** Blocks every open time on a day, asking for an optional reason first. */
  const blockDay = (date: string) => {
    const dayReason = window.prompt(
      `Block all open times on ${shortDate(date)}?\nReason (optional), e.g. Closed for the holiday:`,
      'Closed',
    );
    if (dayReason === null) return; // cancelled
    void block(date, 'whole-day', dayReason);
  };

  const blockSelected = async () => {
    // Group the selected times by day, then block each day's times.
    const byDate = new Map<string, string[]>();
    for (const id of selectedOpen) {
      const [date] = id.split('_');
      const time = rows.find((t) => slotId(date, t) === id);
      if (time) byDate.set(date, [...(byDate.get(date) ?? []), time]);
    }
    for (const [date, times] of byDate) await block(date, times);
  };

  const unblock = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    const result = await call((token) => adminUnblockTimes(token, ids));
    setBusy(false);
    if (!result.ok) return;
    notify(
      `Unblocked ${result.data.unblocked} time${result.data.unblocked === 1 ? '' : 's'}.`,
      'success',
    );
    setSelectedBlocked([]);
    void load();
  };

  const dayInfo = (date: string) => {
    const cells = rows.map((t) => cellFor(date, t));
    return {
      closed: getOpeningSlots(date).length === 0,
      holiday: isHoliday(date),
      openCount: cells.filter((c) => c.kind === 'open').length,
      blockedIds: cells.flatMap((c) => (c.kind === 'blocked' ? [c.id] : [])),
      bookingCount: cells.filter((c) => c.kind === 'booking').length,
    };
  };

  const renderCell = (date: string, time: string, compact: boolean) => {
    const cell = cellFor(date, time);
    const base = `flex w-full items-center rounded-md border text-left text-xs transition ${
      compact
        ? 'min-h-[52px] gap-2 px-3 py-2 text-sm'
        : 'min-h-[44px] px-2 py-1.5'
    }`;
    if (cell.kind === 'closed') {
      return (
        <div className={`${base} border-transparent`} aria-hidden="true" />
      );
    }
    if (cell.kind === 'past') {
      return (
        <div
          className={`${base} border-white/5 bg-slate-800/40 text-slate-600`}
        >
          {compact && (
            <span className="w-[72px] shrink-0 tabular-nums">{time}</span>
          )}
        </div>
      );
    }
    if (cell.kind === 'open') {
      const selected = selectedOpen.includes(cell.id);
      return (
        <button
          type="button"
          onClick={() => toggle(selectedOpen, setSelectedOpen, cell.id)}
          aria-pressed={selected}
          aria-label={`${shortDate(date)} ${time}, open`}
          className={`${base} ${
            selected
              ? 'border-red-500 bg-red-600/25 text-white'
              : 'border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500 hover:text-slate-300'
          }`}
        >
          {compact && (
            <span className="w-[72px] shrink-0 tabular-nums text-slate-300">
              {time}
            </span>
          )}
          <span>{selected ? 'Selected' : compact ? 'Open' : ''}</span>
        </button>
      );
    }
    if (cell.kind === 'blocked') {
      const selected = selectedBlocked.includes(cell.id);
      return (
        <button
          type="button"
          onClick={() => toggle(selectedBlocked, setSelectedBlocked, cell.id)}
          aria-pressed={selected}
          aria-label={`${shortDate(date)} ${time}, blocked${cell.reason ? `: ${cell.reason}` : ''}`}
          className={`${base} ${
            selected
              ? 'border-amber-300 ring-1 ring-amber-300'
              : 'border-slate-600'
          } bg-[repeating-linear-gradient(135deg,rgb(51_65_85)_0,rgb(51_65_85)_6px,rgb(30_41_59)_6px,rgb(30_41_59)_12px)] text-slate-200`}
        >
          {compact && (
            <span className="w-[72px] shrink-0 tabular-nums">{time}</span>
          )}
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span className="ml-1 truncate">{cell.reason || 'Blocked'}</span>
        </button>
      );
    }
    const b = cell.booking;
    return (
      <button
        type="button"
        onClick={() => b && openBooking(b.id)}
        className={`${base} flex-col !items-start border-red-500/40 bg-red-500/15 text-white hover:bg-red-500/25 ${
          compact ? '!flex-row !items-center' : ''
        }`}
      >
        {compact && (
          <span className="w-[72px] shrink-0 tabular-nums">{time}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {b ? `${b.firstName} ${b.lastName}` : 'Booked'}
          </span>
          {b && (
            <span className="block truncate text-[11px] text-red-100/80">
              {b.service}
            </span>
          )}
        </span>
        {compact && b && <StatusBadge status={b.status} />}
      </button>
    );
  };

  const weekLabel = `${shortDate(days[0])} – ${shortDate(days[DAYS_SHOWN - 1])}`;
  const selectedCount = selectedOpen.length + selectedBlocked.length;
  const singleOpen =
    selectedOpen.length === 1 && selectedBlocked.length === 0
      ? selectedOpen[0]
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={ui.button}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`${ui.button} whitespace-nowrap`}
            onClick={() => setWeekStart(startOfWeek(now.date))}
          >
            This week
          </button>
          <button
            type="button"
            className={ui.button}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 text-base font-bold sm:text-lg">{weekLabel}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-red-500/40 bg-red-500/30" />{' '}
            Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-600 bg-slate-600" />{' '}
            Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-700 bg-slate-800" />{' '}
            Open
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-400">
        Tap open times to select them, then block them. Tap a blocked time to
        unblock it, or a booking to open it.
      </p>

      {/* Action bar for the current selection */}
      {selectedCount > 0 && (
        <div
          className={`${ui.card} sticky top-[122px] z-20 flex flex-wrap items-center gap-2 border-red-500/40 p-3 md:top-[76px]`}
        >
          {selectedOpen.length > 0 && (
            <>
              <span className="text-sm font-semibold">
                {selectedOpen.length} open time
                {selectedOpen.length === 1 ? '' : 's'} selected
              </span>
              <input
                className={`${ui.input} !w-auto min-w-[180px] flex-1`}
                placeholder="Reason (optional), e.g. Lunch"
                value={reason}
                maxLength={120}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Reason for blocking"
              />
              <button
                type="button"
                className={ui.primary}
                disabled={busy}
                onClick={blockSelected}
              >
                <Lock className="h-4 w-4" /> Block
              </button>
              {singleOpen && (
                <button
                  type="button"
                  className={ui.button}
                  onClick={() => {
                    const [date] = singleOpen.split('_');
                    const time = rows.find(
                      (t) => slotId(date, t) === singleOpen,
                    );
                    if (time) startBooking(date, time);
                  }}
                >
                  Add booking here
                </button>
              )}
            </>
          )}
          {selectedBlocked.length > 0 && (
            <button
              type="button"
              className={ui.button}
              disabled={busy}
              onClick={() => unblock(selectedBlocked)}
            >
              <LockOpen className="h-4 w-4" /> Unblock {selectedBlocked.length}{' '}
              time
              {selectedBlocked.length === 1 ? '' : 's'}
            </button>
          )}
          <button
            type="button"
            className="ml-auto text-sm text-slate-400 hover:text-white"
            onClick={() => {
              setSelectedOpen([]);
              setSelectedBlocked([]);
            }}
          >
            Clear
          </button>
        </div>
      )}

      {data === null ? (
        <p className="py-10 text-center text-slate-400">Loading calendar...</p>
      ) : (
        <>
          {/* Desktop and tablet: the whole week */}
          <div className={`${ui.card} hidden overflow-x-auto p-3 md:block`}>
            <div
              className="grid min-w-[760px] gap-1.5"
              style={{
                gridTemplateColumns: `72px repeat(${DAYS_SHOWN}, minmax(0, 1fr))`,
              }}
            >
              <div />
              {days.map((date) => {
                const info = dayInfo(date);
                return (
                  <div key={date} className="space-y-1 pb-1 text-center">
                    <p
                      className={`text-sm font-semibold ${date === now.date ? 'text-red-400' : ''}`}
                    >
                      {shortDate(date)}
                    </p>
                    {info.closed ? (
                      <p className="text-xs text-slate-500">
                        {info.holiday ? 'Holiday · closed' : 'Closed'}
                      </p>
                    ) : (
                      <div className="flex justify-center gap-1">
                        {info.openCount > 0 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => blockDay(date)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-700 hover:text-white"
                          >
                            Block day
                          </button>
                        )}
                        {info.blockedIds.length > 0 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => unblock(info.blockedIds)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-700 hover:text-white"
                          >
                            Unblock day
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {rows.map((time) => (
                <div key={time} className="contents">
                  <div className="flex items-center justify-end pr-2 text-xs tabular-nums text-slate-400">
                    {time}
                  </div>
                  {days.map((date) => (
                    <div key={date + time}>{renderCell(date, time, false)}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Phones: one day at a time */}
          <div className="space-y-3 md:hidden">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {days.map((date, index) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setMobileDay(index)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                    index === mobileDay
                      ? 'bg-red-600 text-white'
                      : date === now.date
                        ? 'bg-slate-700 text-red-300'
                        : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {shortDate(date)}
                </button>
              ))}
            </div>
            {(() => {
              const date = days[mobileDay];
              const info = dayInfo(date);
              if (info.closed) {
                return (
                  <p className={`${ui.card} p-6 text-center text-slate-400`}>
                    {info.holiday
                      ? 'Holiday: the shop is closed.'
                      : 'The shop is closed.'}
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {info.openCount > 0 && (
                      <button
                        type="button"
                        className={ui.button}
                        disabled={busy}
                        onClick={() => blockDay(date)}
                      >
                        <Lock className="h-4 w-4" /> Block whole day
                      </button>
                    )}
                    {info.blockedIds.length > 0 && (
                      <button
                        type="button"
                        className={ui.button}
                        disabled={busy}
                        onClick={() => unblock(info.blockedIds)}
                      >
                        <LockOpen className="h-4 w-4" /> Unblock day
                      </button>
                    )}
                  </div>
                  {getOpeningSlots(date).map((time) => (
                    <div key={time}>{renderCell(date, time, true)}</div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
