import { ExternalLink } from "lucide-react";
import { NavLink } from "~/components/nav-link";

export function AlphaBanner() {
  return (
    <div className="mb-6 rounded-md bg-[var(--brand-orange)] p-4">
      <p className="mb-1 font-medium text-sm text-white">Alpha API</p>
      <p className="text-sm text-white/80">
        This API is currently in alpha. Breaking changes may occur between
        releases. We recommend pinning to a specific version and monitoring the{" "}
        <NavLink
          className="inline-flex items-center gap-0.5 text-white underline"
          external
          href="https://lightfast.ai/changelog"
          rel="noopener noreferrer"
          target="_blank"
        >
          changelog <ExternalLink className="h-3 w-3" />
        </NavLink>{" "}
        for updates.
      </p>
    </div>
  );
}
