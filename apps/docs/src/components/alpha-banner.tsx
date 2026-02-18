import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function AlphaBanner() {
  return (
    <div className="bg-[var(--brand-orange)] rounded-md p-4 mb-6">
      <p className="text-sm text-white font-medium mb-1">Alpha API</p>
      <p className="text-sm text-white/80">
        This API is currently in alpha. Breaking changes may occur between
        releases. We recommend pinning to a specific version and monitoring the{" "}
        <Link href="https://lightfast.ai/changelog" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-white underline">
          changelog <ExternalLink className="h-3 w-3" />
        </Link>{" "}
        for updates.
      </p>
    </div>
  );
}
