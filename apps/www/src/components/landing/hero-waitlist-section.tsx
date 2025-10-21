import localFont from "next/font/local";
import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";

const exposureTrial = localFont({
  src: "../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export function HeroWaitlistSection() {
  return (
    <div className="space-y-8">
      <h1
        className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground whitespace-nowrap ${exposureTrial.className}`}
      >
        One interface, infinite agents.
      </h1>
      <div className="max-w-xl">
        <WaitlistForm />
      </div>
    </div>
  );
}
