import { AppFooter } from "~/app/(app)/_components/app-footer";
import { AppNavbar } from "~/app/(app)/_components/app-navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Navbar - fixed overlay */}
      <header className="fixed top-0 right-0 left-0 z-50">
        <div className="mx-auto w-full max-w-7xl">
          <AppNavbar />
        </div>
      </header>

      {/* Main content - sits ON TOP of footer */}
      <main className="relative z-10 min-h-screen bg-background">
        <div className="mx-auto w-full">{children}</div>
      </main>

      {/* Spacer - transparent to reveal footer behind */}
      <div className="dark h-[450px] bg-background md:h-[650px]" />

      {/* Footer - fixed behind content, revealed on scroll */}
      <footer className="fixed right-0 bottom-0 left-0 z-0 h-[450px] md:h-[650px]">
        <AppFooter />
      </footer>
    </div>
  );
}
