"use client"

import { Button } from "@/components/ui/button"
import { Phone } from "lucide-react"
import { openingRange } from "@/lib/booking-rules"
import { useBooking } from "@/hooks/useBooking"

export function CTASection() {
  const { openBooking } = useBooking()
  return (
    <section id="contact-cta" className="w-full bg-[#E31E24] py-12 px-6 sm:px-12 lg:px-20 border-t border-[#B81418]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        
        {/* Left text layout container */}
        <div className="flex flex-col text-left">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
            Ready to Tint Your Ride?
          </h2>
          <p className="text-white/90 text-sm sm:text-base font-medium">
            Call us or book online — Mon–Fri {openingRange('weekday', '–')} · Sat {openingRange('saturday', '–')}
          </p>
        </div>

        {/* Right alignment action control elements container */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
          {/* Secondary phone button contact link layer */}
          <a
            href="tel:773-800-4411"
            className="flex items-center justify-center gap-2 bg-white text-[#111111] font-bold px-6 py-3.5 rounded text-sm hover:bg-neutral-100 transition-colors shadow-sm"
          >
            <Phone className="h-4 w-4 text-[#E31E24] fill-[#E31E24]" />
            <span>773-800-4411</span>
          </a>

          {/* Primary scheduling interaction engine switch element */}
          <Button
            onClick={openBooking}
            className="bg-[#111111] hover:bg-black text-white font-extrabold px-8 py-6 rounded text-sm tracking-wide transition-colors shadow-sm"
          >
            Book Appointment
          </Button>
        </div>

      </div>
    </section>
  )
}
