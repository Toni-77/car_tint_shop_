// Booking rules shared by the booking form (browser) and the booking server action.
// Keeping them in one place means the form and the server always agree, and the
// server can re-check everything the form checks.

export const SHOP_TIME_ZONE = 'America/Chicago';

// Customers can't book a time that starts sooner than this many minutes from now.
export const BOOKING_LEAD_MINUTES = 60;

// Opening hours (24-hour clock, Chicago time). Sunday is closed.
// The last appointment starts LAST_APPOINTMENT_BEFORE_CLOSE minutes before closing,
// so a job doesn't start right as the shop closes.
export const OPENING_HOURS = {
  weekday: { open: '09:00', close: '17:30' }, // Monday-Friday
  saturday: { open: '09:00', close: '15:30' },
} as const;
export const LAST_APPOINTMENT_BEFORE_CLOSE = 60;
export const SLOT_INTERVAL_MINUTES = 30;

function clockToMinutes(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Opening hours for display, e.g. openingRange('weekday') -> "9:00 AM – 5:30 PM". */
export function openingRange(
  day: keyof typeof OPENING_HOURS,
  separator = ' \u2013 ',
): string {
  const { open, close } = OPENING_HOURS[day];
  return `${formatSlot(clockToMinutes(open))}${separator}${formatSlot(clockToMinutes(close))}`;
}

/** e.g. "Monday-Friday: 9:00 AM-5:30 PM. Saturday: 9:00 AM-3:30 PM." */
export function openingHoursText(): string {
  const range = ({ open, close }: { open: string; close: string }) =>
    `${formatSlot(clockToMinutes(open))}\u2013${formatSlot(clockToMinutes(close))}`;
  return (
    `Monday\u2013Friday: ${range(OPENING_HOURS.weekday)}. ` +
    `Saturday: ${range(OPENING_HOURS.saturday)}.`
  );
}

export const SERVICES = [
  'Window Tint',
  'Ceramic Coating',
  'Paint Protection Film',
] as const;
export type Service = (typeof SERVICES)[number];

export const VEHICLE_TYPES = [
  'Sedan',
  'Coupe',
  'Convertible',
  'Hatchback',
  'Wagon',
  'SUV',
  'Minivan',
  'Van',
  'Pickup Truck',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const TINT_SHADES = [
  '5% (limo)',
  '15%',
  '20%',
  '35%',
  '50%',
  '70% (lightest)',
  'Not sure - please advise',
] as const;

export const TINT_WINDOWS = [
  'Front side windows',
  'Rear side windows',
  'Rear windshield',
  'Windshield sun strip',
  'Full windshield',
  'Sunroof',
] as const;

export const FILM_REMOVAL_OPTIONS = ['No', 'Yes', 'Not sure'] as const;

export const NOTES_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// Dates and times, always in the shop's time zone (not the visitor's or the server's)
// ---------------------------------------------------------------------------

const shopClock = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function shopParts(instant: Date) {
  const parts: Record<string, number> = {};
  for (const part of shopClock.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts as Record<
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
    number
  >;
}

/** Today's date (YYYY-MM-DD) and minutes since midnight at the shop. */
export function shopNow(now: Date = new Date()): {
  date: string;
  minutes: number;
} {
  const p = shopParts(now);
  return {
    date: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`,
    minutes: p.hour * 60 + p.minute,
  };
}

function parseDateString(dateString: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

export function isValidDateString(dateString: string): boolean {
  return parseDateString(dateString) !== null;
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): number {
  const first = weekdayOf(year, month, 1);
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(year: number, month: number, weekday: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayWeekday = weekdayOf(year, month, lastDay);
  return lastDay - ((lastDayWeekday - weekday + 7) % 7);
}

/**
 * Closed on: New Year's Day, Memorial Day, Independence Day, Labor Day,
 * Thanksgiving, Christmas and New Year's Eve.
 */
export function isHoliday(dateString: string): boolean {
  const parsed = parseDateString(dateString);
  if (!parsed) return false;
  const [year, month, day] = parsed;

  if (month === 1 && day === 1) return true;
  if (month === 7 && day === 4) return true;
  if (month === 12 && (day === 25 || day === 31)) return true;
  if (month === 5 && day === lastWeekday(year, 5, 1)) return true;
  if (month === 9 && day === nthWeekday(year, 9, 1, 1)) return true;
  if (month === 11 && day === nthWeekday(year, 11, 4, 4)) return true;
  return false;
}

function formatSlot(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

/** "9:30 AM" -> 570 minutes after midnight, or null if it isn't a valid time. */
export function slotToMinutes(slot: string): number | null {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(slot.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return ((hour % 12) + (match[3] === 'PM' ? 12 : 0)) * 60 + minute;
}

/**
 * Every appointment start time on a date according to opening hours, regardless
 * of today's date or bookings: every 30 minutes from opening until an hour before
 * closing (see OPENING_HOURS). Empty on Sundays and holidays.
 */
export function getOpeningSlots(dateString: string): string[] {
  const parsed = parseDateString(dateString);
  if (!parsed) return [];

  const weekday = weekdayOf(...parsed);
  if (weekday === 0 || isHoliday(dateString)) return [];

  const hours = weekday === 6 ? OPENING_HOURS.saturday : OPENING_HOURS.weekday;
  const firstStart = clockToMinutes(hours.open);
  const lastStart = clockToMinutes(hours.close) - LAST_APPOINTMENT_BEFORE_CLOSE;

  const slots: string[] = [];
  for (
    let minutes = firstStart;
    minutes <= lastStart;
    minutes += SLOT_INTERVAL_MINUTES
  ) {
    slots.push(formatSlot(minutes));
  }
  return slots;
}

/**
 * Appointment start times customers can book on a date, ignoring bookings:
 * the opening slots, minus past dates and times inside the lead window today.
 */
export function getAvailableTimeSlots(
  dateString: string,
  now: Date = new Date(),
): string[] {
  const today = shopNow(now);
  if (!isValidDateString(dateString) || dateString < today.date) return [];

  const earliest =
    dateString === today.date ? today.minutes + BOOKING_LEAD_MINUTES : 0;
  return getOpeningSlots(dateString).filter(
    (slot) => (slotToMinutes(slot) ?? 0) >= earliest,
  );
}

/** Adds days to a YYYY-MM-DD date, e.g. addDays("2026-11-02", 1) -> "2026-11-03". */
export function addDays(dateString: string, days: number): string {
  const parsed = parseDateString(dateString);
  if (!parsed) return dateString;
  const [year, month, day] = parsed;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Monday of the week a date falls in (YYYY-MM-DD). */
export function startOfWeek(dateString: string): string {
  const parsed = parseDateString(dateString);
  if (!parsed) return dateString;
  const weekday = weekdayOf(...parsed); // 0 = Sunday
  return addDays(dateString, weekday === 0 ? -6 : 1 - weekday);
}

/** Stable id for one appointment time, e.g. "2026-11-02_0930". */
export function slotId(dateString: string, slot: string): string {
  const minutes = slotToMinutes(slot) ?? 0;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${dateString}_${hh}${mm}`;
}

/** The exact moment a shop-time appointment starts, e.g. 9:00 AM Chicago time. */
export function shopTimeToDate(dateString: string, slot: string): Date {
  const parsed = parseDateString(dateString);
  const minutes = slotToMinutes(slot);
  if (!parsed || minutes === null) {
    throw new Error(`Invalid appointment date or time: ${dateString} ${slot}`);
  }
  const [year, month, day] = parsed;
  const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, minutes);

  const offsetAt = (instant: number) => {
    const p = shopParts(new Date(instant));
    const asUtc = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
    );
    return Math.round((asUtc - instant) / 60000);
  };

  // Check the offset twice so dates near a daylight-saving change come out right.
  let offset = offsetAt(wallClockAsUtc);
  const adjusted = offsetAt(wallClockAsUtc - offset * 60000);
  if (adjusted !== offset) offset = adjusted;
  return new Date(wallClockAsUtc - offset * 60000);
}

/** "2026-11-02" -> "Monday, November 2, 2026" */
export function formatDisplayDate(dateString: string): string {
  const parsed = parseDateString(dateString);
  if (!parsed) return dateString;
  const [year, month, day] = parsed;
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    'en-US',
    {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    },
  );
}

// ---------------------------------------------------------------------------
// Text checks
// ---------------------------------------------------------------------------

/** Real names such as O'Connor, Anne-Marie and accented letters. */
export function validPersonName(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length <= 50 &&
    /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u.test(trimmed)
  );
}

/** Letters, numbers, spaces and common punctuation in a make or model. */
export function validVehicleText(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length <= 50 &&
    /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .&'’()/+-]*$/u.test(trimmed)
  );
}

export function validEmail(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(trimmed)
  );
}

/** Any 10-digit US number, with or without +1 -> "(312) 555-0123", else null. */
export function normalizeUSPhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Free-text notes: no angle brackets or hidden control characters. */
export function validNotes(value: string): boolean {
  return (
    value.length <= NOTES_MAX_LENGTH &&
    !/[<>]/.test(value) &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)
  );
}
