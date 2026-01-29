import { AppNavbarV2 } from "~/components/app-navbar-v2";
import { AppFooter } from "~/components/app-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Main wrapper */}
      <div className="relative min-h-screen flex flex-col">
        {/* Navbar */}
        <AppNavbarV2 />

        {/* Main content with background */}
        <main className="flex-1 py-16 bg-background">{children}</main>

        {/* Footer - normal flow on mobile, margin-bottom for desktop spacing */}
        <footer className="mt-auto">
          <AppFooter />
        </footer>
      </div>
    </>
  );
}
