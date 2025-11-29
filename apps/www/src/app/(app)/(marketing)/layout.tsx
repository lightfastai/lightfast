import { AppNavbar } from "~/components/app-navbar";

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
    </div>
  );
}
