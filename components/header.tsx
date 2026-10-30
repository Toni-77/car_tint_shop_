"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Phone, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBooking } from "@/hooks/useBooking"

const PHONE = "773-800-4411"

const navLinks = [
  { href: "#", label: "Home" },
  { href: "#window-tint", label: "Window Tint" },
  { href: "#ceramic-coating", label: "Ceramic Coating" },
  { href: "#paint-protection", label: "Paint Protection Film" },
  { href: "#reviews", label: "Reviews" },
]

/** Logo icon with the shop name as real text, so it stays sharp and readable at any size. */
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Supernova Tinting home">
      <Image
        src="/images/logo-mark.png"
        alt=""
        width={compact ? 40 : 52}
        height={compact ? 42 : 55}
        className="shrink-0"
        priority
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-extrabold tracking-[0.08em] text-primary ${
            compact ? "text-lg" : "text-2xl"
          }`}
        >
          SUPERNOVA
        </span>
        <span
          className={`mt-1 font-medium tracking-[0.45em] text-white/85 ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          TINTING
        </span>
      </span>
    </Link>
  )
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { openBooking } = useBooking()

  return (
    <header className="relative z-50 w-full">
      {/* Desktop Navigation */}
      <nav className="hidden items-center justify-between px-6 py-4 lg:flex xl:px-10">
        <Logo />

        <div className="flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="relative text-[15px] font-medium text-white/80 transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all after:duration-200 hover:text-white hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-5">
          <a
            href={`tel:${PHONE}`}
            className="flex items-center gap-2 text-white transition-colors hover:text-primary"
          >
            <Phone className="h-4 w-4 text-primary" />
            <span className="text-[15px] font-semibold">{PHONE}</span>
          </a>

          <Button
            onClick={openBooking}
            className="h-11 rounded-md bg-primary px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-primary/90"
          >
            Book Appointment
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation: Call, Get Quote and Book live in the bar at the bottom of the screen */}
      <nav className="lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo compact />

          <div className="flex items-center gap-1">
            <a
              href={`tel:${PHONE}`}
              className="rounded-full p-2.5 text-white"
              aria-label={`Call ${PHONE}`}
            >
              <Phone className="h-5 w-5 text-primary" />
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="p-2 text-white"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-gray-800 bg-black/95 px-4 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block border-b border-gray-800 py-3 text-gray-300 transition-colors last:border-0 hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
