import { RootLayout } from "@/components/root-layout";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Input } from "@repo/ui/components/ui/input";
import { trpc } from "@vendor/trpc/client/react-proxy";

export default function HomePage() {
  const { data, isLoading, error } = useQuery(
    trpc.app.auth.randomSecret.queryOptions(),
  );
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return (
    <RootLayout>
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="flex items-center justify-center font-serif text-4xl text-gray-100">
            <Sparkles className="mr-3 size-5 text-orange-500" />
            Hello, night owl {data}
          </h1>
        </div>

        <div className="mb-6 w-full max-w-xl">
          <Input />
        </div>
      </div>
    </RootLayout>
  );
}
