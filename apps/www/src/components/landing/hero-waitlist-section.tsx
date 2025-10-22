import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import { exposureTrial } from "~/lib/fonts";

export function HeroWaitlistSection() {
  return (
    <div className="space-y-8">
      <h1
        className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground whitespace-nowrap ${exposureTrial.className}`}
      >
        One interface, infinite agents.
      </h1>
      <WaitlistForm />
    </div>
  );
}
