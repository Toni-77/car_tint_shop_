import { Star } from "lucide-react"

const reviews = [
  {
    id: 1,
    text: "Ben did an amazing job, taking his time to explain what different types of tint will look on my car. He's a true craftsman — really glad I came here.",
    author: "Abraham S.",
    initial: "A",
  },
  {
    id: 2,
    text: "Brought my BMW in for ceramic coating and PPF — the result is flawless. The team was professional and the shop was spotless. Highly recommend!",
    author: "Marcus T.",
    initial: "M",
  },
  {
    id: 3,
    text: "Quick, affordable, and the tint looks factory. No bubbles, no edges lifting. I've already sent three of my friends here. Top-notch service.",
    author: "Jessica R.",
    initial: "J",
  },
]

export function Testimonials() {
  return (
    <section id="reviews" className="px-6 lg:px-16 py-16 lg:py-24 bg-card">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs tracking-[3px] text-primary uppercase font-semibold">
          Happy Customers
        </span>
        <div className="flex-1 max-w-[60px] h-px bg-primary" />
      </div>
      
      <h2 className="font-sans text-4xl lg:text-5xl font-bold tracking-wide mb-12 text-white">
        {"What They're Saying"}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="bg-secondary border border-border p-6 hover:border-primary/40 transition-colors"
          >
            <div className="text-4xl font-serif text-primary opacity-60 leading-none mb-2">
              &ldquo;
            </div>
            <p className="text-gray-300 text-base leading-relaxed mb-6">
              {review.text}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-sans text-lg font-bold text-white">
                {review.initial}
              </div>
              <div>
                <div className="font-semibold text-white text-base">{review.author}</div>
                <div className="flex text-amber-400 text-xs tracking-wider">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
