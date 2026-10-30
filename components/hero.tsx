// src/components/hero.tsx
'use client'

import React from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { useBooking } from "@/hooks/useBooking"

export function Hero() {
  const { openBooking, openQuote } = useBooking()
  return (
    <section className="relative w-full min-h-[85vh] bg-black flex items-center overflow-hidden px-6 md:px-12 lg:px-20 border-b border-gray-900">
      {/* Background Car Image Layout */}
      <div className="absolute inset-0 z-0 flex justify-end items-center opacity-70 lg:opacity-100 select-none pointer-events-none">
        <div className="relative w-full lg:w-[65%] h-full min-h-[85vh]">
          <Image
            src="/images/hero-car.png" // Verify this matches your public directory car image name
            alt="Premium Black Sports Car"
            fill
            priority
            className="object-cover object-right"
          />
          {/* Subtle gradient to blend image into the black background */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent lg:from-black lg:via-black/20" />
        </div>
      </div>

      {/* Hero Typography Content */}
      <div className="relative z-10 max-w-2xl text-left flex flex-col justify-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Premium Window <br />
          <span className="text-gray-400">Tinting in Chicago</span>
        </h1>
        
        <p className="mt-4 text-sm md:text-base text-gray-400 font-medium tracking-wide max-w-md border-l-2 border-red-600 pl-4 space-y-1">
          <span className="block">Ceramic & Carbon Tint | Lifetime Warranty</span>
          <span className="block text-gray-500 font-normal">Precision Installation</span>
        </p>
        
        {/* Call to Action Button Row */}
        <div className="mt-8 flex flex-row items-center gap-4">
          <Button 
            onClick={openQuote}
            className="h-12 bg-red-600 hover:bg-red-700 text-white rounded-md text-[15px] font-semibold px-7 transition-transform active:scale-95 cursor-pointer"
          >
            Get Quote
          </Button>
          
          <button
            onClick={openBooking}
            type="button"
            className="h-12 border-2 border-red-600/80 hover:border-red-600 bg-transparent hover:bg-red-600/10 text-white font-semibold px-7 rounded-md text-[15px] transition-all active:scale-95 cursor-pointer"
          >
            Book Appointment
          </button>
        </div>
      </div>
    </section>
  )
}
