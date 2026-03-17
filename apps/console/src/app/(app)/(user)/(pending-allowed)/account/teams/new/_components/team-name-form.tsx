"use client";

import { Input } from "@repo/ui/components/ui/input";
import { useState } from "react";
import { SubmitButton } from "../../_components/submit-button";
import { createTeam } from "../_actions/create-team";
import { SlugPreview } from "./slug-preview";

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "");
}

export function TeamNameForm() {
  const [slug, setSlug] = useState("");

  return (
    <form action={createTeam} className="space-y-4">
      <div className="space-y-2">
        <label
          className="font-medium text-muted-foreground text-sm"
          htmlFor="teamSlug"
        >
          Your Team Name
        </label>
        <Input
          autoFocus
          className="font-mono"
          id="teamSlug"
          name="teamSlug"
          onChange={(e) => setSlug(normalize(e.target.value))}
          placeholder="acme-inc"
          required
          value={slug}
        />
        <SlugPreview slug={slug} />
      </div>
      <SubmitButton label="Continue" pendingLabel="Creating..." />
    </form>
  );
}
