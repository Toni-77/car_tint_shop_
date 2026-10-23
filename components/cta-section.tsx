import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTASection() {
  return (
    <section className="bg-primary px-6 lg:px-16 py-12 lg:py-20">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
        <div className="text-center lg:text-left">
          <h2 className="font-sans text-4xl lg:text-5xl font-bold tracking-wide text-white mb-2">
            Ready to Tint Your Ride?
          </h2>
          <p className="text-white/80 text-base">
            Call us or book online — Mon–Sat, 9:00 AM to 5:30 PM
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-white/90 font-bold text-base tracking-wide px-8"
          >
            <a href="tel:773-800-4411">
              <Phone className="h-4 w-4 mr-2" />
              773-800-4411
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="bg-black/30 border-2 border-white/30 text-white hover:border-white hover:bg-black/50 font-bold text-base tracking-wide px-8"
          >
            Book Appointment
          </Button>
        </div>
      </div>
    </section>
  )
}
