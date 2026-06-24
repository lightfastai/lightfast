import type { ReactNode } from "react";
import { Footer } from "./_components/footer";
import {
  MarketingContent,
  marketingLayout,
} from "./_components/layout-primitives";
import { Sidebar } from "./_components/sidebar";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="group/company min-h-svh overflow-x-clip bg-background">
      <Sidebar />
      <div
        className={`min-h-svh bg-background ${marketingLayout.companyShift}`}
      >
        <MarketingContent>{children}</MarketingContent>
        <Footer />
      </div>
    </div>
  );
}
