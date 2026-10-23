import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative min-h-[500px] lg:min-h-[600px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-car.png"
          alt="Premium black car with tinted windows"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 lg:px-12 py-16 lg:py-24 max-w-2xl">
        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
          Premium Window
          <br />
          Tinting{" "}
          <span className="text-gray-400 font-normal">in Chicago</span>
        </h1>

        <p className="mt-4 text-gray-300 text-sm lg:text-base">
          Ceramic & Carbon Tint | Lifetime Warranty
          <br className="hidden lg:block" />
          <span className="lg:hidden"> | </span>
          Precision Installation
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base rounded-md">
            Get Quote
          </Button>
          <Button
            variant="outline"
            className="border-gray-500 bg-transparent text-white hover:bg-white/10 px-8 py-6 text-base rounded-md"
          >
            Book Appointment
          </Button>
        </div>
      </div>
    </section>
  )
}
