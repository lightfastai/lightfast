import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { SiteFooter } from "~/components/site-footer";

interface LegalLayoutProps {
  children: React.ReactNode;
}

function LegalHeader() {
  return (
    <header className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Icons.logoShort className="w-6 h-5 text-foreground" />
          </Link>
        </div>
        <Link href="/signin">
          <Button variant="outline">Sign In</Button>
        </Link>
      </div>
    </header>
  );
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <LegalHeader />
      <div className="container flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
