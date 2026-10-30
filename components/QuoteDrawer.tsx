'use client';

import SideDrawer from './SideDrawer';
import QuoteEstimator from './QuoteEstimator';
import type { BookingPrefill } from './BookingForm';

interface QuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBook: (prefill: BookingPrefill) => void;
}

export default function QuoteDrawer({
  isOpen,
  onClose,
  onBook,
}: QuoteDrawerProps) {
  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Get a Quote"
      subtitle="Instant price estimate"
      footerNote="Estimates are confirmed before any work starts."
    >
      <QuoteEstimator onBook={onBook} />
    </SideDrawer>
  );
}
