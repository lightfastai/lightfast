import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function ConnectHeader() {
  return (
    <div className="mb-8">
      <Link
        href="../sources"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Sources
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Connect Integration</h1>
      <p className="text-muted-foreground mt-2">
        Add a new source to your workspace
      </p>
    </div>
  );
}
