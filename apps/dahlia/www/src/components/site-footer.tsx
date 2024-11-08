import { siteConfig } from "~/config/site";

export function SiteFooter() {
  return (
    <footer className="w-full py-6">
      <div className="container flex flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground">
          {siteConfig.name} @ 2025
        </p>
      </div>
    </footer>
  );
}
