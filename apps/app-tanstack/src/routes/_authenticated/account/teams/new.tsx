import { useOrganizationList } from "@clerk/tanstack-react-start";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  createTeamIdempotencyKey,
  normalizeTeamSlug,
} from "~/account/team-name";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/_authenticated/account/teams/new")({
  head: () => ({
    meta: [
      { title: "Create Team - Lightfast" },
      {
        name: "description",
        content: "Create a Lightfast team workspace.",
      },
    ],
  }),
  component: CreateTeamPage,
});

function CreateTeamPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setActive } = useOrganizationList();
  const navigate = useNavigate();

  const mutation = useMutation(
    trpc.viewer.organization.create.mutationOptions({
      meta: { suppressErrorToast: true },
      onSuccess: async (data) => {
        idempotencyKeyRef.current = null;
        if (setActive) {
          await setActive({ organization: data.organizationId });
        }
        void queryClient.invalidateQueries({
          queryKey:
            trpc.viewer.organization.listUserOrganizations.queryOptions()
              .queryKey,
        });
        await navigate({ to: "/$slug", params: { slug: data.slug } });
      },
      onError: (err) => {
        setError(err.message ?? "Failed to create team. Please try again.");
      },
    })
  );

  const handleSubmit = (event: React.FormEvent) => {
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

function SlugPreview({ slug }: { slug: string }) {
  return (
    <p className="font-mono text-muted-foreground text-sm">
      lightfast.ai/
      <span className="text-foreground">{slug || "your-team"}</span>
    </p>
  );
}
