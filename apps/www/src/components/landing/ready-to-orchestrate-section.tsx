"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import localFont from "next/font/local";

const exposureTrial = localFont({
  src: "../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export function ReadyToOrchestrateSection() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="bg-background py-16 px-16">
      <div className=" mx-auto">
        <Link
          href="/docs"
          className="block"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`
              relative overflow-hidden
              border border-border
              p-36
              transition-all duration-700 ease-out
              ${
                isHovered
                  ? "bg-muted text-foreground"
                  : "bg-background text-foreground"
              }
            `}
          >
            <div
              className={`transition-all duration-700 origin-left ${
                isHovered ? "scale-[1.04]" : "scale-100"
              }`}
            >
              {/* Top text */}
              <p
                className={`text-sm mb-8 transition-colors duration-700 ${
                  isHovered ? "text-muted-foreground" : "text-muted-foreground"
                }`}
              >
                READY TO BUILD?
              </p>

              {/* Main heading */}
              <h2
                className={`text-6xl font-light leading-[1.2] tracking-[-0.7] mb-6 ${exposureTrial.className}`}
              >
                Ready to orchestrate?
              </h2>

              {/* Description */}
              <p
                className={`text-lg max-w-2xl mb-12 transition-colors duration-700 ${
                  isHovered ? "text-foreground/70" : "text-foreground/70"
                }`}
              >
                Build AI agents that actually work in production. Start with our
                documentation to learn how to orchestrate complex workflows,
                manage resources, and deploy agents in minutes.
              </p>

              {/* CTA with arrow */}
              <div className="flex items-center gap-4">
                <span className="text-lg font-medium">
                  Explore Documentation
                </span>
                <ArrowRight
                  className={`w-8 h-8 transition-transform duration-700 ${
                    isHovered ? "translate-x-2" : ""
                  }`}
                />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
