"use client"
import BookingDrawer from "@/components/BookingDrawer"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Phone, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const navLinks = [
  { href: "#", label: "Home" },
  { href: "#window-tint", label: "Window Tint" },
  { href: "#ceramic-coating", label: "Ceramic Coating" },
  { href: "#paint-protection", label: "Paint Protection Film" },
  { href: "#reviews", label: "Reviews" },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="w-full relative z-50">
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo.png"
            alt="Supernova Tinting Logo"
            width={160}
            height={60}
            className="object-contain"
          />
        </Link>

        <div className="flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <a
            href="tel:773-800-4411"
            className="flex items-center gap-2 text-white hover:text-primary transition-colors"
          >
            <Phone className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-white">773-800-4411</span>
          </a>
          
          {/* Desktop Booking Drawer */}
          <BookingDrawer />
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Supernova Tinting Logo"
              width={120}
              height={45}
              className="object-contain"
            />
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white p-2"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <div className="px-4 py-2 text-center">
          <a
            href="tel:773-800-4411"
            className="flex items-center justify-center gap-2 text-white"
          >
            <Phone className="h-4 w-4 text-primary" />
            <span className="font-semibold">773-800-4411</span>
          </a>
        </div>

        <div className="flex gap-3 px-4 py-3">
          <Button className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-md text-sm">
            Get Quote
          </Button>
          
          {/* Mobile Booking Drawer */}
          <BookingDrawer />
        </div>

        {mobileMenuOpen && (
          <div className="px-4 py-4 border-t border-gray-800 bg-black/95">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block py-3 text-gray-300 hover:text-white transition-colors border-b border-gray-800 last:border-0"
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
