import { Icons } from "@repo/ui/components/icons";
import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";
import { WaitlistDescription } from "./_components/(waitlist)/waitlist-description";
import { localFont } from "next/font/local";

const exposureTrial = localFont({
  src: "../../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export default function HomePage() {
  return (
    <div className="flex h-screen">
      {/* Left Section - 61.8% (Golden Ratio) */}
      <div className="w-[61.8%] flex flex-col p-8 border-r border-dashed border-foreground">
        {/* Top: Logo */}
        <div>
          <Icons.logo className="w-24" />
        </div>

        {/* Middle: Headline and Waitlist Form - positioned at 38.2% from top */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="space-y-8">
            <h1
              className={`text-6xl font-light leading-[1.2] text-foreground pr-8 ${exposureTrial.className}`}
            >
              One interface, infinite agents.
            </h1>
            <div className="max-w-2xl">
              <WaitlistForm />
            </div>
          </div>
        </div>

        {/* Bottom: Waitlist Description */}
        <div className="max-w-xl">
          <WaitlistDescription />
        </div>
      </div>

      {/* Right Section - 38.2% (Golden Ratio Complement) */}
      <div className="w-[38.2%] h-full" />
    </div>
  );
}
