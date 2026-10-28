"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Phone, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBooking } from "@/hooks/useBooking"

const navLinks = [
{ href: "#", label: "Home" },
{ href: "#window-tint", label: "Window Tint" },
{ href: "#ceramic-coating", label: "Ceramic Coating" },
{ href: "#paint-protection", label: "Paint Protection Film" },
{ href: "#reviews", label: "Reviews" },
]

export function Header() {
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
const { openBooking } = useBooking()

return (
<header className="relative z-50 w-full">
{/* Desktop Navigation */}
<nav className="hidden items-center justify-between px-6 py-4 lg:flex">
<Link href="/" className="flex items-center">
<div className="relative h-[60px] w-[160px]">
<Image
           src="/images/logo.png"
           alt="Supernova Tinting Logo"
           fill
           sizes="160px"
           className="object-contain"
           priority
         />
</div>
</Link>

    <div className="flex items-center gap-8">
      {navLinks.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="text-sm text-gray-300 transition-colors hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </div>

    <div className="flex items-center gap-4">
      <a
        href="tel:773-800-4411"
        className="flex items-center gap-2 text-white transition-colors hover:text-primary"
      >
        <Phone className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-white">
          773-800-4411
        </span>
      </a>

      <Button
        onClick={openBooking}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary/90"
      >
        Book Appointment
      </Button>
    </div>
  </nav>

  {/* Mobile Navigation */}
  <nav className="lg:hidden">
    <div className="flex items-center justify-between px-4 py-3">
      <Link href="/" className="flex items-center">
        <div className="relative h-[45px] w-[120px]">
          <Image
            src="/images/logo.png"
            alt="Supernova Tinting Logo"
            fill
            sizes="120px"
            className="object-contain"
            priority
          />
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        className="p-2 text-white"
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
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
      <Button
        type="button"
        className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 text-sm text-white hover:bg-neutral-700"
      >
        Get Quote
      </Button>

      <Button
        type="button"
        onClick={openBooking}
        className="flex-1 rounded-md bg-primary text-sm font-semibold text-white transition-all duration-200 hover:bg-primary/90"
      >
        Book Appointment
      </Button>
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