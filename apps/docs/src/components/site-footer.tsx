import { siteConfig } from "~/config/site";

export function SiteFooter() {
  return (
    <footer className="w-full py-6">
      <div className="container flex flex-row">
        <p className="text-muted-foreground text-center text-xs leading-loose text-balance">
          {siteConfig.name} @ 2025
        </p>
      </div>
    </footer>
  );
}
