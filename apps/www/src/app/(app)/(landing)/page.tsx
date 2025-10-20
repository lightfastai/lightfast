import { Icons } from "@repo/ui/components/icons";
import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";

export default function HomePage() {
  return (
    <div className="flex h-screen">
      {/* Left Section - 61.8% (Golden Ratio) */}
      <div className="w-[61.8%] flex flex-col p-8 border-r border-dashed border-muted">
        {/* Top: Logo - 38.2% of vertical space */}
        <div className="mb-[38.2%]">
          <Icons.logo className="w-24" />
        </div>

        {/* Middle: Headline and CTA - First Golden Ratio Quadrant */}
        <div className="flex flex-col justify-start max-w-[61.8%] gap-8">
          <h1 className="text-6xl font-serif font-light leading-[1.2] text-foreground pr-8">
            The agent execution engine built for production
          </h1>

          {/* CTA positioned in golden ratio quadrant */}
          <div className="pt-4">
            <WaitlistForm />
          </div>
        </div>

        {/* Bottom: Spacer to maintain golden ratio proportions */}
        <div className="flex-1" />
      </div>

      {/* Right Section - 38.2% (Golden Ratio Complement) */}
      <div className="w-[38.2%] h-full" />
    </div>
  );
}
