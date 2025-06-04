import Image from "next/image";

import blueSkyImg from "../../public/blue-sky.0.png";

export function OpenSourceMcpSection() {
  return (
    <section className="bg-background py-20">
      <div className="mx-auto flex flex-col items-center justify-between gap-12 px-8 md:flex-row">
        {/* Left: Text Content */}
        <div className="flex h-full min-h-[340px] flex-1 flex-col justify-between">
          <div className="mb-64">
            <h2 className="text-foreground mb-6 text-4xl leading-tight font-semibold md:text-5xl">
              We've started building{" "}
              <span className="text-primary">open-source integrations</span> for
              Lightfast MCP.
              <br />
              Join us as we connect creative tools, AI, and cloud workflows—
              <span className="italic">in the open</span>.
            </h2>
          </div>
          <div className="mt-auto space-y-6">
            <div>
              <h3 className="text-foreground mb-1 text-lg font-semibold">
                Open Source
              </h3>
              <p className="text-muted-foreground max-w-xs text-sm">
                All MCP integrations are open-source and available on GitHub.
                Contribute, fork, or follow along as we build.
              </p>
            </div>
            <div>
              <h3 className="text-foreground mb-1 text-lg font-semibold">
                AI Model Chat Interface
              </h3>
              <p className="text-muted-foreground max-w-xs text-sm">
                Try our AI-powered chat interface for model control, automation,
                and creative workflows—right from your terminal.
              </p>
            </div>
          </div>
        </div>
        {/* Right: Image and Blog Link */}
        <div className="flex w-full flex-shrink-0 flex-col items-center md:w-96">
          <div className="relative mb-4 h-64 w-full overflow-hidden rounded-xl shadow-lg">
            <Image
              src={blueSkyImg}
              alt="Blue sky illustration"
              fill
              style={{ objectFit: "cover" }}
              className="rounded-xl"
              priority
            />
          </div>
          <a
            href="/blog"
            className="text-primary mt-2 flex items-center gap-2 text-base font-semibold hover:underline"
            aria-label="Read our blog post about open-source MCP integrations"
          >
            Blog: Read now
            <svg
              className="ml-1 h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
