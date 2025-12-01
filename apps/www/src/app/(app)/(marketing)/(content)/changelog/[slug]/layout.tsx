import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export default function ChangelogEntryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <Button variant="secondary" className="rounded-full" size="lg" asChild>
          <Link href="/changelog" prefetch className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            See all changelog
          </Link>
        </Button>
      </div>
      {children}
    </>
  );
}
