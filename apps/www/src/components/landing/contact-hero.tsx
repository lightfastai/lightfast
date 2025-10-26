import { exposureTrial } from "~/lib/fonts";

/**
 * ContactHero - Full-width gradient hero section
 *
 * Design: Large "contact" text on left, down arrow on right
 * Gradient: Similar aesthetic to your branding pages
 */
export function ContactHero() {
  return (
    <section className="relative w-full overflow-hidden h-96">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-rose-400/80 to-teal-500/90" />

      {/* Content */}
      <div className="relative h-full flex items-end py-16 justify-between px-16">
        {/* Large "contact" text */}
        <h1
          className={`text-7xl sm:text-8xl lg:text-9xl font-light text-white leading-none tracking-tight ${exposureTrial.className}`}
        >
          contact
        </h1>
      </div>
    </section>
  );
}
