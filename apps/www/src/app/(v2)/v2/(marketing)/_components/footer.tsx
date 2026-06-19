import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-12">
      <div className="mx-auto flex min-h-48 max-w-[1960px] flex-col justify-between gap-20">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-medium text-3xl tracking-normal">© 2026</p>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-10 gap-y-4 text-sm"
          >
            <Link className="hover:underline" href="/legal/terms">
              Terms of Use
            </Link>
            <Link className="hover:underline" href="/legal/privacy">
              Privacy Policy
            </Link>
            <span className="border border-border px-5 py-2">
              English <span>United States</span>
            </span>
          </nav>
        </div>
        <p className="font-medium text-3xl tracking-normal">Lightfast</p>
      </div>
    </footer>
  );
}
