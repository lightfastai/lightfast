import { MarketingNavbar } from "~/components/marketing/marketing-navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full bg-background h-screen overflow-hidden fixed inset-0">
      {/* Top Navbar - fixed and on top */}
      <MarketingNavbar />

      {/* Content area - fills entire screen behind navbar */}
      <main className="absolute inset-0 overflow-hidden">{children}</main>
    </div>
  );
}
