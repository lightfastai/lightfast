"use client";

import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useOrganizationList } from "@vendor/clerk/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SlugPreview } from "./slug-preview";

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "");
}

export function TeamNameForm() {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setActive } = useOrganizationList();
  const router = useRouter();

  const mutation = useMutation(
    trpc.organization.create.mutationOptions({
      onSuccess: async (data) => {
        if (setActive) {
          await setActive({ organization: data.organizationId });
        }
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.listUserOrganizations.queryOptions().queryKey,
        });
        router.push(`/account/teams/invite?teamSlug=${data.slug}`);
      },
      onError: (err) => {
        setError(err.message ?? "Failed to create team. Please try again.");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError(undefined);
    mutation.mutate({ slug });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <p className="text-destructive text-sm">{error}</p>}
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
          onChange={(e) => {
            setSlug(normalize(e.target.value));
            setError(undefined);
          }}
          placeholder="acme-inc"
          required
          value={slug}
        />
        <SlugPreview slug={slug} />
      </div>
      <Button className="w-full" disabled={mutation.isPending} type="submit">
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}
