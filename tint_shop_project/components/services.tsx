import Image from "next/image"

const services = [
  {
    id: "window-tint",
    title: "Window Tint",
    image: "/images/window-tint.png",
    alt: "Professional window tinting service",
  },
  {
    id: "ceramic-coating",
    title: "Ceramic Coating",
    image: "/images/ceramic-coating.png",
    alt: "Ceramic coating application",
  },
  {
    id: "paint-protection",
    title: "Paint Protection Film",
    image: "/images/paint-protection.png",
    alt: "Paint protection film installation",
  },
]

export function Services() {
  return (
    <section className="px-6 lg:px-16 py-12 lg:py-16 bg-card">
      <div className="text-center mb-12">
        <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-2">
          What We Do
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
          Our Services
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Professional automotive protection and enhancement services, installed with precision and backed by lifetime warranty.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {services.map((service) => (
          <div key={service.id} id={service.id} className="group relative overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">
              {service.title}
            </h3>
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
              <Image
                src={service.image}
                alt={service.alt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <button className="bg-primary hover:bg-primary/90 text-white text-xs px-4 py-2 rounded font-semibold">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
