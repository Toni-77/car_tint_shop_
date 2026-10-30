'use client';

import SideDrawer from './SideDrawer';
import BookingForm, { type BookingPrefill } from './BookingForm';

interface BookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Answers to fill in ahead of time, e.g. from the Get Quote estimator. */
  prefill?: BookingPrefill;
  /** Changes whenever a new prefill is sent, so the form starts fresh with it. */
  prefillKey?: number;
}

export default function BookingDrawer({
  isOpen,
  onClose,
  prefill,
  prefillKey = 0,
}: BookingDrawerProps) {
  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Book an Appointment"
      subtitle="Vehicle and service details"
      footerNote="Your appointment request is subject to confirmation."
    >
      <BookingForm key={prefillKey} onClose={onClose} prefill={prefill} />
    </SideDrawer>
  );
}
