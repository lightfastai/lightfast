import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <div className="relative flex-1">
        <main className="h-full">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
