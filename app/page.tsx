'use client'

import { useState } from "react"
import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Services } from "@/components/services"
import { WhyChooseUs } from "@/components/why-choose-us"
import { Testimonials } from "@/components/testimonials"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import BookingDrawer from "@/components/BookingDrawer"

export default function Home() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleBookClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDrawerOpen(true)
  }

  return (
    <main className="min-h-screen bg-background">
      <Header onBookClick={handleBookClick} />
      <Hero onBookClick={handleBookClick} />
      <Services />
      <WhyChooseUs />
      <Testimonials />
      <CTASection onBookClick={handleBookClick} />
      <Footer />

      <BookingDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </main>
  )
}
