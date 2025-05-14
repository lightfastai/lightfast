import Link from "next/link";

import { Icons } from "~/components/icons";

export function SiteHeader() {
  return (
    <header className="w-full px-4 py-6 md:px-6">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <Icons.logo className="size-4" />
            <h1 className="font-base text-lg">
              <span>Lightfast</span>{" "}
              <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
                Computer
              </span>
            </h1>
          </Link>
        </div>
      </div>
    </header>
  );
}
