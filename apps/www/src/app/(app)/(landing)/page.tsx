import { Icons } from "@repo/ui/components/icons";
import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";
import { WaitlistDescription } from "./_components/(waitlist)/waitlist-description";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
import { localFont } from "next/font/local";

const exposureTrial = localFont({
  src: "../../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export default function HomePage() {
  return (
    <div className="flex flex-col hero bg-background min-h-screen">
      {/* Top Section */}
      <div className="flex flex-1 border-b border-dashed border-muted">
        {/* Left Section */}
        <div className="flex flex-col flex-1 px-16 pt-8 py-16 border-r border-dashed border-muted">
          {/* Top: Logo */}
          <div>
            <Icons.logo className="w-36 text-foreground" />
          </div>

          {/* Middle: Headline and Waitlist Form */}
          <div className="flex-1 flex flex-col justify-center w-full relative">
            {/* Dotted line above */}
            <div className="-mx-16 border-t border-dashed border-muted mb-8" />

            <div className="space-y-8 w-full px-0">
              <h1
                className={`text-7xl font-light leading-[1.2] tracking-[-0.7] text-foreground whitespace-nowrap ${exposureTrial.className}`}
              >
                One interface, infinite agents.
              </h1>
              <div className="max-w-3xl">
                <WaitlistForm />
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div />
        </div>

        {/* Right Section */}
        <div className="flex flex-col px-16 py-16 justify-end relative">
          {/* Bottom: Waitlist Description */}
          <div className="max-w-xl">
            {/* Dashed line above */}
            <div className="-mx-16 border-t border-dashed border-muted mb-8" />
            <WaitlistDescription />
          </div>
        </div>
      </div>

      {/* Bottom Section: Framework Showcase */}
      <div className="px-16 py-16 border-t border-dashed border-muted">
        <FrameworkShowcase />
      </div>
    </div>
  );
}
