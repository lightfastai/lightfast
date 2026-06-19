import { createOrganization } from "@api/app/tanstack/organizations";
import { Loading03Icon as Loader2 } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import {
  createTeamIdempotencyKey,
  normalizeTeamSlug,
} from "~/account/team-name";
import { useOrganizationList } from "~/compat/clerk";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import { organizationQueryKeys } from "~/organization/organization-cache";

export function CreateTeamClient() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <TeamSwitcherSlot />
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Create your team
          </h1>
          <TeamNameForm />
        </div>
      </div>
    </main>
  );
}

function TeamNameForm() {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string>();
  const idempotencyKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { setActive } = useOrganizationList();
  const navigate = useNavigate({ from: "/account/teams/new" });

  const mutation = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (data: { idempotencyKey: string; slug: string }) =>
      createOrganization({ data }),
    onSuccess: async (data) => {
      idempotencyKeyRef.current = null;
      if (setActive) {
        await setActive({ organization: data.organizationId });
      }
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.list(),
      });
      await navigate({ to: "/$slug", params: { slug: data.slug } });
    },
    onError: (err) => {
      setError(err.message ?? "Failed to create team. Please try again.");
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!slug) {
      return;
    }
    idempotencyKeyRef.current ??= createTeamIdempotencyKey();
    setError(undefined);
    mutation.mutate({ idempotencyKey: idempotencyKeyRef.current, slug });
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
          onChange={(event) => {
            setSlug(normalizeTeamSlug(event.target.value));
            idempotencyKeyRef.current = null;
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
            <HugeiconsIcon
              className="mr-2 h-4 w-4 animate-spin"
              icon={Loader2}
            />
            Creating...
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}

function SlugPreview({ slug }: { slug: string }) {
  return (
    <p className="font-mono text-muted-foreground text-sm">
      lightfast.ai/
      <span className="text-foreground">{slug || "your-team"}</span>
    </p>
  );
}
