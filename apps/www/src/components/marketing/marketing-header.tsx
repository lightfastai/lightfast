import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { VerticalNavbar } from "~/components/landing/vertical-navbar";

export function MarketingHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 flex px-16 pt-8 pb-8 items-start justify-between z-10">
      {/* Logo */}
      <div className="-ml-2">
        <Button
          variant="ghost"
          size="lg"
          className="hover:bg-black hover:text-white"
          asChild
        >
          <Link href="/">
            <Icons.logo className="size-22 text-foreground" />
          </Link>
        </Button>
      </div>

      {/* Navbar */}
      <div>
        <VerticalNavbar />
      </div>
    </header>
  );
}
