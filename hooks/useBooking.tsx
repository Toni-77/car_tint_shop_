"use client"

import React, { createContext, useCallback, useContext, useState } from "react"
import BookingDrawer from "@/components/BookingDrawer"
import QuoteDrawer from "@/components/QuoteDrawer"
import type { BookingPrefill } from "@/components/BookingForm"

interface BookingContextType {
  /** Opens the booking form. Pass answers to fill in ahead of time (optional). */
  openBooking: (prefill?: BookingPrefill | React.SyntheticEvent) => void
  closeBooking: () => void
  isOpen: boolean
  /** Opens the Get Quote estimator. */
  openQuote: (event?: React.SyntheticEvent) => void
  closeQuote: () => void
  isQuoteOpen: boolean
}

const BookingContext = createContext<BookingContextType | undefined>(undefined)

// The site's one booking drawer and one quote drawer live here, so every
// "Book Appointment" and "Get Quote" button on the page opens the same ones.
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isQuoteOpen, setIsQuoteOpen] = useState(false)
  const [prefill, setPrefill] = useState<BookingPrefill | undefined>()
  const [prefillKey, setPrefillKey] = useState(0)

  const openBooking = useCallback((arg?: BookingPrefill | React.SyntheticEvent) => {
    // Buttons can pass their click event straight in: onClick={openBooking}
    if (arg && "nativeEvent" in arg) {
      arg.preventDefault()
    } else if (arg) {
      setPrefill(arg)
      setPrefillKey((key) => key + 1) // start the form fresh with these answers
    }
    setIsQuoteOpen(false)
    setIsOpen(true)
  }, [])
  const closeBooking = useCallback(() => setIsOpen(false), [])

  const openQuote = useCallback((event?: React.SyntheticEvent) => {
    event?.preventDefault()
    setIsOpen(false)
    setIsQuoteOpen(true)
  }, [])
  const closeQuote = useCallback(() => setIsQuoteOpen(false), [])

  return (
    <BookingContext.Provider
      value={{ openBooking, closeBooking, isOpen, openQuote, closeQuote, isQuoteOpen }}
    >
      {children}
      <BookingDrawer
        isOpen={isOpen}
        onClose={closeBooking}
        prefill={prefill}
        prefillKey={prefillKey}
      />
      <QuoteDrawer isOpen={isQuoteOpen} onClose={closeQuote} onBook={openBooking} />
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
