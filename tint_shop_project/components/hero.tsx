'use client'
import React, { useState, useEffect } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import BookingForm from "./BookingForm"

export function Hero() {
  const [isOpen, setIsOpen] = useState(false)

  // Prevent background body scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <>
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
            
            {/* The trigger button remains exactly your original element, executing the local click state */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(true)}
              className="border-gray-500 bg-transparent text-white hover:bg-white/10 px-8 py-6 text-base rounded-md"
            >
              Book Appointment
            </Button>
          </div>
        </div>
      </section>

      {/* SELF-CONTAINED DRAWER MARKUP - Renders outside the section layout to guarantee zero style breaks */}
      <div 
        className={`fixed inset-0 z-[9999] transition-all duration-300 ${
          isOpen ? 'visible' : 'invisible pointer-events-none'
        }`}
      >
        {/* Dark Backdrop Overlay */}
        <div 
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
        />

        {/* Sliding Side Panel */}
        <div 
          className={`absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl transition-transform duration-500 ease-in-out transform ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full bg-white text-slate-900">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">New Appointment</h2>
                <p className="text-sm text-slate-500">Service & Vehicle Details</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-gray-200 transition-colors text-slate-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Booking Form Context */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <BookingForm />
            </div>

            {/* Footer / Branding */}
            <div className="p-4 border-t bg-gray-50 text-center">
              <p className="text-xs text-slate-400">© Supernova Tinting Request System</p>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
