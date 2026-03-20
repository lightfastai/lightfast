"use client";

import { SearchInput } from "./search-input";

export function SearchInterface() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      {/* Header */}
      <h1 className="font-pp font-light text-5xl text-foreground tracking-[-0.7]">
        Search about Lightfast
      </h1>

      {/* Search Input */}
      <SearchInput />
    </div>
  );
}
