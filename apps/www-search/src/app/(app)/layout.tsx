import { NavigationOverlayProvider } from "~/components/landing/navigation-overlay-provider";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <NavigationOverlayProvider>
      <div className="relative flex min-h-screen flex-col">
        <div className="relative flex-1">
          <main className="h-full">{children}</main>
        </div>
      </div>
    </NavigationOverlayProvider>
  );
}
