import { AppNavbarV2 } from "~/components/app-navbar-v2";
import { AppFooter } from "~/components/app-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Navbar - fixed overlay */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto w-full">
          <AppNavbarV2 />
        </div>
      </header>

      {/* Main content - sits ON TOP of footer */}
      <main className="relative z-10 min-h-screen bg-background border-b">
        <div className="mx-auto w-full">{children}</div>
      </main>

      {/* Spacer - transparent to reveal footer behind */}
      <div className="h-[800px] md:h-[650px] dark bg-background" />

      {/* Footer - fixed behind content, revealed on scroll */}
      <footer className="fixed bottom-0 left-0 right-0 z-0 h-[800px] md:h-[650px]">
        <AppFooter />
      </footer>
    </div>
  );
}
