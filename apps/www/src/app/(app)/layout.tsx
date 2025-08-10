import { EnhancedHeader } from "~/components/enhanced-header";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <EnhancedHeader />
      <div className="relative flex-1">
        <main className="h-full">{children}</main>
      </div>
    </div>
  );
}
