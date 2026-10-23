import Link from "next/link"
import { Phone, MapPin, Mail } from "lucide-react"

const serviceLinks = [
  { href: "#window-tint", label: "Window Tint" },
  { href: "#ceramic-coating", label: "Ceramic Coating" },
  { href: "#paint-protection", label: "Paint Protection Film" },
  { href: "#paint-correction", label: "Paint Correction" },
]

const companyLinks = [
  { href: "#", label: "About Us" },
  { href: "#reviews", label: "Reviews" },
  { href: "#", label: "Gallery" },
  { href: "#", label: "Contact" },
]

export function Footer() {
  return (
    <footer className="bg-background border-t border-border px-6 lg:px-16 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
        {/* Brand Column */}
        <div>
          <h3 className="font-sans text-2xl font-bold tracking-widest text-white mb-4">
            Supernova Tinting
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4 max-w-[250px]">
            {"Chicago's premier destination for window tinting, ceramic coating, and paint protection film."}
          </p>
          <div className="text-muted-foreground text-sm space-y-2">
            <a href="tel:773-800-4411" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Phone className="h-4 w-4" />
              <span className="text-primary">773-800-4411</span>
            </a>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>Chicago, Illinois</span>
            </div>
            <a href="mailto:info@supernova-tinting.com" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Mail className="h-4 w-4" />
              <span>info@supernova-tinting.com</span>
            </a>
          </div>
        </div>

        {/* Services Column */}
        <div>
          <h4 className="font-sans text-lg font-bold tracking-widest text-muted-foreground mb-4">
            Services
          </h4>
          <ul className="space-y-2">
            {serviceLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-muted-foreground text-sm hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company Column */}
        <div>
          <h4 className="font-sans text-lg font-bold tracking-widest text-muted-foreground mb-4">
            Company
          </h4>
          <ul className="space-y-2">
            {companyLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-muted-foreground text-sm hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Hours Column */}
        <div>
          <h4 className="font-sans text-lg font-bold tracking-widest text-muted-foreground mb-4">
            Hours
          </h4>
          <div className="text-muted-foreground text-sm space-y-1">
            <p className="text-white font-medium">Mon – Sat</p>
            <p>9:00 AM – 5:30 PM</p>
            <p className="text-muted-foreground/60 mt-3">Sunday: Closed</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border pt-6 flex flex-col lg:flex-row justify-between items-center gap-4 text-center lg:text-left">
        <p className="text-muted-foreground text-sm">
          © 2025 Supernova Tinting. All rights reserved.
        </p>
        <div className="text-muted-foreground text-sm flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <span className="text-white">773-800-4411</span>
          <span className="mx-2">|</span>
          <span>Chicago, IL</span>
        </div>
      </div>
    </footer>
  )
}
