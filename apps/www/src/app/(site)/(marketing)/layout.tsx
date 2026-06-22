import type { ReactNode } from "react";
import { Footer } from "./_components/footer";
import { Sidebar } from "./_components/sidebar";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="group/company min-h-svh overflow-x-clip bg-background">
      <Sidebar />
      <div className="min-h-svh bg-background transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-has-[[data-company-trigger][data-popup-open]]/company:-translate-x-8 group-has-[[data-company-trigger][data-popup-open]]/company:duration-1000">
        <div className="mx-auto w-full max-w-4xl px-6 sm:px-10 lg:px-32">
          {children}
        </div>
        <Footer />
      </div>
    </div>
  );
}
