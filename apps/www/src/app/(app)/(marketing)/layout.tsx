import { AppNavbar } from "~/components/app-navbar";
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
          <AppNavbar />
        </div>
      </header>

      {/* Main content - sits ON TOP of footer */}
      <main className="relative z-10 min-h-screen bg-background">
        <div className="mx-auto w-full">{children}</div>
      </main>

      {/* Spacer - transparent to reveal footer behind */}
      <div className="h-[450px] md:h-[800px] dark bg-background" />

      {/* Footer - fixed behind content, revealed on scroll */}
      <footer className="fixed bottom-0 left-0 right-0 z-0 h-[450px] md:h-[800px]">
        <AppFooter />
      </footer>
    </div>
  );
}
