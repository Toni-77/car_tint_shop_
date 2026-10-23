import { Trophy, Zap, Target, Building } from "lucide-react"

const features = [
  {
    icon: Trophy,
    title: "Lifetime Warranty",
    description: "Every tint installation is backed by a lifetime warranty against bubbling, peeling, and fading.",
  },
  {
    icon: Zap,
    title: "Same-Day Service",
    description: "Most installs completed same day. In and out without losing your whole day.",
  },
  {
    icon: Target,
    title: "Master Technicians",
    description: "Our installers have 10+ years experience with luxury, exotic, and everyday vehicles.",
  },
  {
    icon: Building,
    title: "Illinois Legal Compliance",
    description: "We know Chicago tint laws. Every install is done within legal limits — no surprises.",
  },
]

const stats = [
  { value: "500+", label: "Cars Done" },
  { value: "4.9", label: "Star Rating" },
  { value: "10+", label: "Years Exp" },
  { value: "100%", label: "Satisfaction" },
]

export function WhyChooseUs() {
  return (
    <section className="px-6 lg:px-16 py-16 lg:py-24 bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Content Side */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs tracking-[3px] text-primary uppercase font-semibold">
              Why Choose Us
            </span>
            <div className="flex-1 max-w-[60px] h-px bg-primary" />
          </div>
          
          <h2 className="font-sans text-4xl lg:text-5xl font-bold tracking-wide mb-4 text-white">
            {"Chicago's Most Trusted Tint Shop"}
          </h2>
          
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Every vehicle treated like it&apos;s our own. No shortcuts, no compromises.
          </p>

          <div className="flex flex-col gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 items-start p-4 border border-border hover:border-primary transition-colors"
              >
                <div className="w-9 h-9 flex-shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <feature.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base mb-1">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Visual Side */}
        <div className="hidden lg:flex relative bg-secondary border border-border aspect-[4/3] items-center justify-center overflow-hidden">
          <span className="absolute font-sans text-8xl tracking-widest text-primary/5 font-bold">
            SNT
          </span>
          <div className="relative z-10 grid grid-cols-2 gap-px bg-border border border-border w-4/5">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-card p-6 text-center">
                <div className="font-sans text-4xl text-primary tracking-wide font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground tracking-widest uppercase mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
