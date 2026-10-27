"use client"

import React, { createContext, useContext, useState } from "react"
import BookingDrawer from "@/components/BookingDrawer"

interface BookingContextType {
  openBooking: () => void
  closeBooking: () => void
  isOpen: boolean
}

const BookingContext = createContext<BookingContextType | undefined>(undefined)

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openBooking = () => setIsOpen(true)
  const closeBooking = () => setIsOpen(false)

  return (
    <BookingContext.Provider value={{ openBooking, closeBooking, isOpen }}>
      {children}
      <BookingDrawer isOpen={isOpen} onClose={closeBooking} />
    </BookingContext.Provider>
  )
}

export function useBooking() {
  const context = useContext(BookingContext)
  if (!context) {
    throw new Error("useBooking must be used within a BookingProvider")
  }
  return context
}
