import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import BookingDrawer from "@/components/BookingDrawer"

export function CTASection() {
  return (
    <section className="bg-primary px-6 py-12 lg:px-16 lg:py-20">
      <div className="flex flex-col items-center justify-between gap-6 lg:flex-row lg:gap-8">
        {/* Call-to-action heading */}
        <div className="text-center lg:text-left">
          <h2 className="mb-2 font-sans text-4xl font-bold tracking-wide text-white lg:text-5xl">
            Ready to Tint Your Ride?
          </h2>

          <p className="text-base text-white/80">
            Call us or book online — Mon–Sat, 9:00 AM to 5:30 PM
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto">
          {/* Phone button */}
          <Button
            asChild
            size="lg"
            className="bg-white px-8 text-base font-bold tracking-wide text-primary hover:bg-white/90"
          >
            <a href="tel:773-800-4411">
              <Phone
                aria-hidden="true"
                className="mr-2 h-4 w-4"
              />

              773-800-4411
            </a>
          </Button>

          {/* Reusable appointment button */}
          <BookingDrawer
            showIcon={false}
            buttonClassName="bg-black/30 border-2 border-white/30 text-white hover:border-white hover:bg-black/50 font-bold text-base tracking-wide px-8"
          />
        </div>
      </div>
    </section>
  )
}