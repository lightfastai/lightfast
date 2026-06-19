import type { ReactNode } from "react";
import { Cta } from "./_components/cta";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="group/about min-h-svh overflow-x-clip bg-background">
      <Header />
      <div className="min-h-svh bg-background transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-has-[[data-about-trigger][data-popup-open]]/about:-translate-x-[5%] group-has-[[data-about-trigger][data-popup-open]]/about:duration-[1250ms]">
        {children}
        <Cta />
        <Footer />
      </div>
    </div>
  );
}
