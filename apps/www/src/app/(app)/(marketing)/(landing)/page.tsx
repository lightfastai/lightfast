import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import { exposureTrial } from "~/lib/fonts";
import { LightfastSineWaveMatrix } from "~/components/landing/lightfast-sine-wave-matrix";
import { ExaSearchVisual } from "~/components/landing/exa-search-visual";

export default function HomePage() {
  return (
    <div className="h-screen w-full overflow-hidden relative">
      {/* Hero Section - brand blue background with content */}
      <div className="brand bg-background absolute top-0 left-0 right-0 h-[80vh]">
        <div className="h-full page-gutter relative flex items-start pt-32 lg:pt-48">
          <div className="w-full flex items-start">
            {/* Hero content - centered on page, same as Exa search visual */}
            <div className="absolute left-0 right-0 page-gutter">
              <div className="w-full flex justify-center">
                <div className="max-w-5xl w-full flex flex-col space-y-4 md:space-y-6 lg:space-y-8">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                      Memory built for teams
                    </p>
                    <h1
                      className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] text-foreground ${exposureTrial.className}`}
                    >
                      Search everything your team knows.
                      <br /> Get answers with sources, instantly.
                    </h1>
                  </div>

                  <div className="max-w-xl py-16">
                    <WaitlistForm />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exa Search Visual - positioned to overlap and get cut off */}
      <div
        className="absolute top-[60vh] md:top-[58vh] lg:top-[65vh] left-0 right-0 page-gutter"
        style={{ zIndex: 10 }}
      >
        <div className="w-full flex justify-center">
          <div className="max-w-5xl w-full">
            <ExaSearchVisual />
          </div>
        </div>
      </div>
    </div>
  );
}
