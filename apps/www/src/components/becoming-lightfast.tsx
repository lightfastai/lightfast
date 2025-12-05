/**
 * Becoming Lightfast Section
 *
 * Seed funding announcement with gradient visual
 * Minimalist design inspired by Polar's announcement style
 */

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BecomingLightfast() {
  return (
    <section className="bg-card rounded-xl border border-transparent">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-16">
          {/* Content Section */}
          <div className="flex flex-col items-center text-center gap-6">
            {/* Small label */}
            <p className="text-sm text-muted-foreground">Launching Soon</p>

            {/* Main Heading */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
              Announcing Lightfast
            </h2>

            {/* CTA Button */}
            <Link
              href="/blog/announcement"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full text-base font-medium hover:bg-primary/90 transition-colors"
            >
              <span>Read the announcement</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Visual Section */}
          <div className="w-full">
            <div className="rounded-lg overflow-hidden h-[400px] md:h-[500px] lg:h-[600px] relative">
              <Image
                src="https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/62c40fbf-28d6-4ef3-8db6-89af016e7200/public"
                alt="Lightfast Seed Round"
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
              {/* Frosted glass effect overlay */}
              <div className="absolute inset-0 backdrop-blur-sm bg-white/5" />
              {/* Gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
