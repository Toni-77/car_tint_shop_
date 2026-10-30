import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Services } from "@/components/services"
import { WhyChooseUs } from "@/components/why-choose-us"
import { Testimonials } from "@/components/testimonials"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { MobileActionBar } from "@/components/mobile-action-bar"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Services />
      <WhyChooseUs />
      <Testimonials />
      <CTASection />
      <Footer />
      <MobileActionBar />
      {/* The booking and quote drawers live in BookingProvider (app/layout.tsx). */}
    </main>
  )
}
