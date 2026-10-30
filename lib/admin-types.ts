// Shapes shared by the admin page and the admin server actions.

export const BOOKING_STATUSES = [
  'requested',
  'confirmed',
  'completed',
  'cancelled',
  'no-show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
};

export type AdminBooking = {
  id: string;
  status: BookingStatus;
  source: 'website' | 'admin';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicle: { type: string; year: string; make: string; model: string };
  service: string;
  tint: { shade: string; windows: string[]; removeOldFilm: string } | null;
  notes: string;
  date: string;
  timeSlot: string;
  slotId: string;
  createdAt: string;
  adminNotes: { at: string; text: string }[];
  history: { at: string; action: string }[];
};

export type CalendarSlot = {
  id: string;
  date: string;
  timeSlot: string;
  kind: 'booking' | 'block';
  bookingId?: string;
  reason?: string;
};

export type ActionResult<T = null> =
  | { ok: true; data: T; emailSent?: boolean; emailError?: string }
  | { ok: false; error: string };

export type NewBookingInput = {
  vehicleType: string;
  year: string;
  make: string;
  model: string;
  service: string;
  tintShade?: string;
  tintWindows?: string[];
  filmRemoval?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  date: string;
  timeSlot: string;
  notes?: string;
  status: 'requested' | 'confirmed';
  sendEmail: boolean;
  /** The quote this booking came from, if any. */
  quoteId?: string;
};

export type CustomerHistoryItem = {
  kind: 'booking' | 'quote';
  id: string;
  date: string; // YYYY-MM-DD (appointment date, or the day the quote was made)
  time: string; // appointment time, or '' for quotes
  title: string; // e.g. "Window Tint" or "Quote: Window Tint"
  detail: string; // vehicle and options
  status: string; // label, e.g. "Completed", "Booked"
};

export type Customer = {
  key: string;
  name: string;
  phone: string;
  email: string;
  vehicles: string[];
  bookings: number;
  completed: number;
  noShows: number;
  quotes: number;
  firstSeen: string; // YYYY-MM-DD
  lastVisit: string | null;
  nextBooking: { date: string; time: string } | null;
  note: string;
  history: CustomerHistoryItem[];
};

/** Answers to fill in on Add booking (from the Calendar, a quote or a customer). */
export type AdminBookingPrefill = Partial<
  Omit<NewBookingInput, 'sendEmail' | 'status'>
>;
