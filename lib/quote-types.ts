// Shapes for saved Get Quote estimates.

/** "new" and "contacted" are quotes with an email; null = an estimate with no contact. */
export type QuoteStatus = 'new' | 'contacted' | 'booked';

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
};

export type AdminQuote = {
  id: string;
  createdAt: string; // ISO
  vehicleType: string;
  service: string;
  summary: string;
  priceLow: number;
  priceHigh: number;
  email: string;
  status: QuoteStatus | null;
  bookingId: string;
  // What the estimator selected, to pre-fill a booking.
  tintWindows: string[];
  removeOldTint: boolean;
};
