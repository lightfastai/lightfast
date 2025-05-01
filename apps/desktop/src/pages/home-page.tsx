import { RootLayout } from "@/components/root-layout";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default function HomePage() {
  const { data, isLoading, error } = useQuery(
    trpc.app.auth.randomSecret.queryOptions(),
  );

  return (
    <RootLayout>
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="flex items-center justify-center font-serif text-4xl text-gray-100">
            <Sparkles className="mr-3 size-5 text-orange-500" />
            Hello, {!data ? <Skeleton className="h-8 w-20" /> : "night owl"}
          </h1>
        </div>

        <div className="mb-6 w-full max-w-xl">
          <Input />
        </div>
      </div>
    </RootLayout>
  );
}
