import Link from "next/link";

import { Icons } from "@repo/ui/components/icons";

export function SiteHeader() {
  return (
    <header className="w-full px-4 py-6 md:px-6">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <Icons.logo className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
