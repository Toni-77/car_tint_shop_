"use client"

import { Phone, Calculator, CalendarCheck } from "lucide-react"
import { useBooking } from "@/hooks/useBooking"

const PHONE = "773-800-4411"

/** Phones only: Call, Get Quote and Book always within thumb reach at the bottom of the screen. */
export function MobileActionBar() {
  const { openBooking, openQuote } = useBooking()

  const item =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors"

  return (
    <>
      {/* Keeps the bar from covering the bottom of the page */}
      <div className="h-[68px] lg:hidden" aria-hidden="true" />

      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-white/10 bg-black/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
      >
        <a href={`tel:${PHONE}`} className={`${item} rounded-lg text-white/85 hover:text-white`}>
          <Phone className="h-5 w-5 text-primary" />
          Call
        </a>
        <button
          type="button"
          onClick={openQuote}
          className={`${item} rounded-lg text-white/85 hover:text-white`}
        >
          <Calculator className="h-5 w-5 text-primary" />
          Get Quote
        </button>
        <button
          type="button"
          onClick={openBooking}
          className={`${item} flex-[1.4] rounded-lg bg-primary text-white hover:bg-primary/90`}
        >
          <CalendarCheck className="h-5 w-5" />
          Book Now
        </button>
      </nav>
    </>
  )
}
