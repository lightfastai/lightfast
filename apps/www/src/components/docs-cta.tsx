import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { exposureTrial } from "~/lib/fonts";

export function DocsCTA() {
  return (
    <section>
      <div className="mx-auto">
        <Link href="/docs" className="group block">
          <div
            className="
              relative overflow-hidden
              border border-border
              p-18 rounded-sm
              bg-accent/40 text-foreground
              hover:bg-card
              transition-all duration-700 ease-out
            "
          >
            {/* Right image - absolutely positioned to extend to edges */}
            <div className="absolute top-0 right-0 bottom-0 w-[30%] overflow-hidden hidden lg:block">
              <div className="h-full transition-transform duration-700 ease-out group-hover:scale-110">
                <Image
                  src="/images/blue-sky.webp"
                  alt="Lightfast Playground"
                  width={800}
                  height={600}
                  className="w-full h-full object-cover"
                  priority
                  unoptimized
                />
              </div>
            </div>

            {/* Content - with right padding to avoid image overlap */}
            <div className="relative z-10 lg:pr-[calc(30%+3rem)]">
              <div className="transition-all duration-700 origin-left group-hover:scale-[1.04]">
                {/* Top text */}
                <p className="text-sm mb-8 text-muted-foreground transition-colors duration-700">
                  READY TO BUILD?
                </p>

                {/* Main heading */}
                <h2
                  className={`text-6xl font-light leading-[1.2] tracking-[-0.7] mb-6 ${exposureTrial.className}`}
                >
                  Ready to orchestrate?
                </h2>

                {/* Description */}
                <p className="text-lg max-w-2xl mb-12 text-foreground/70 transition-colors duration-700">
                  Build AI agents that actually work in production. Start with
                  our documentation to learn how to orchestrate complex
                  workflows, manage resources, and deploy agents in minutes.
                </p>

                {/* CTA with arrow */}
                <div className="flex items-center gap-4">
                  <span className="text-lg font-medium">
                    Explore Documentation
                  </span>
                  <ArrowRight className="w-8 h-8 transition-transform duration-700 group-hover:translate-x-2" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
