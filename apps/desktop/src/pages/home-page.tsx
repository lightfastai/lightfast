import React from "react";
import { RootLayout } from "@/components/root-layout";
import ToggleTheme from "@/components/toggle-theme";
import { Sparkles } from "lucide-react";

import { Input } from "@repo/ui/components/ui/input";

export default function HomePage() {
  return (
    <RootLayout>
      <ToggleTheme />
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="flex items-center justify-center font-serif text-4xl text-gray-100">
            <Sparkles className="mr-3 size-5 text-orange-500" />
            Hello, night owl
          </h1>
        </div>

        <div className="mb-6 w-full max-w-xl">
          <Input />
        </div>
      </div>
    </RootLayout>
  );
}
