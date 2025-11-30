import { AppNavbar } from "~/components/app-navbar";
import { AppFooter } from "~/components/app-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Sticky Navbar */}
      <AppNavbar />

      {/* Main content area - grows to fill available space */}
      <main className="flex-1 py-16">{children}</main>

      {/* Footer */}
      <div className="pb-16 max-w-6xl px-4 mx-auto">
        <AppFooter />
      </div>
    </div>
  );
}
