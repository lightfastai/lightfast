"use client";

import { SearchInput } from "./search-input";
import { exposureTrial } from "~/lib/fonts";

export function SearchInterface() {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <h1
        className={`text-5xl font-light tracking-[-0.7] text-foreground ${exposureTrial.className}`}
      >
        Search about Lightfast
      </h1>

      {/* Search Input */}
      <SearchInput />
    </div>
  );
}
