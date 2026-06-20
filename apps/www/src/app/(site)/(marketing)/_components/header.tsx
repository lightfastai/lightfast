import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Button } from "@repo/ui-v2/components/ui/button";
import Link from "next/link";
import { About } from "./about";

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-background px-6 py-3 transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-has-[[data-about-trigger][data-popup-open]]/about:-translate-x-[5%] group-has-[[data-about-trigger][data-popup-open]]/about:duration-[1250ms] sm:px-10">
      <nav className="mx-auto flex h-10 max-w-[1960px] items-center justify-between gap-8">
        <Link
          aria-label="Lightfast home"
          className="shrink-0 text-foreground transition-colors hover:text-muted-foreground"
          href="/"
        >
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-10">
          <About />
          <Button
            className="px-0"
            nativeButton={false}
            render={<Link href="/blog" />}
            variant="link"
          >
            Blog
          </Button>
          <Button
            className="px-0"
            nativeButton={false}
            render={<Link href="/brand" />}
            variant="link"
          >
            Brand
          </Button>
        </div>
      </nav>
    </header>
  );
}
