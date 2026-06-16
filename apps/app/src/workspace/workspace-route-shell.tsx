import type { OrgSetupRequirement } from "@repo/app-setup-contract";
import { Button } from "@repo/ui/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, useOrganizationList } from "~/compat/clerk";
import { AppSidebar } from "~/components/app-sidebar";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import { organizationBySlugQueryOptions } from "~/organization/organization-queries";
import {
  getSetupRequirementRedirect,
  isOrgSetupCompletePath,
  isOrgSetupExemptPath,
  isOrgSetupPath,
} from "./workspace-route-model";

function SetupRequirementNavigate({
  requirement,
  slug,
}: {
  requirement: OrgSetupRequirement;
  slug: string;
}) {
  const redirect = getSetupRequirementRedirect(requirement, slug);

  return <Navigate params={redirect.params} replace to={redirect.to} />;
}

export function WorkspaceRouteShell({ slug }: { slug: string }) {
  const location = useLocation();
  const { orgId } = useAuth();
  const { setActive } = useOrganizationList();
  const [activeOrgSync, setActiveOrgSync] = useState<{
    orgId: string;
    status: "error" | "pending" | "synced";
  } | null>(null);
  const {
    data: orgAccess,
    error,
    isPending,
  } = useQuery({
    ...organizationBySlugQueryOptions({ slug }),
  });

  useEffect(() => {
    const targetOrgId = orgAccess?.org.id;
    if (!targetOrgId) {
      setActiveOrgSync(null);
      return;
    }

    if (orgId === targetOrgId) {
      setActiveOrgSync({ orgId: targetOrgId, status: "synced" });
      return;
    }

    if (!setActive) {
      setActiveOrgSync({ orgId: targetOrgId, status: "pending" });
      return;
    }

    let cancelled = false;
    setActiveOrgSync({ orgId: targetOrgId, status: "pending" });
    void setActive({ organization: targetOrgId })
      .then(() => {
        if (!cancelled) {
          setActiveOrgSync({ orgId: targetOrgId, status: "synced" });
        }
      })
      .catch((activationError: unknown) => {
        console.error("[organization-route] Failed to activate Clerk org", {
          error: activationError,
          orgId: targetOrgId,
          slug,
        });
        if (!cancelled) {
          setActiveOrgSync({ orgId: targetOrgId, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgAccess?.org.id, orgId, setActive, slug]);

  if (isPending) {
    return <OrganizationHomeSkeleton slug={slug} />;
  }

  if (error || !orgAccess) {
    return <OrganizationNotFound slug={slug} />;
  }

  const activeOrgSynced =
    orgId === orgAccess.org.id ||
    (activeOrgSync?.orgId === orgAccess.org.id &&
      activeOrgSync.status === "synced");

  if (!activeOrgSynced) {
    if (activeOrgSync?.status === "error") {
      return <OrganizationActivationError slug={slug} />;
    }
    return <OrganizationHomeSkeleton slug={slug} />;
  }

  if (
    orgAccess.bindingStatus !== "bound" &&
    !isOrgSetupExemptPath(slug, location.pathname)
  ) {
    return (
      <SetupRequirementNavigate
        requirement={orgAccess.nextSetupRequirement}
        slug={slug}
      />
    );
  }

  if (
    orgAccess.bindingStatus === "bound" &&
    isOrgSetupPath(slug, location.pathname) &&
    !isOrgSetupCompletePath(slug, location.pathname)
  ) {
    return <Navigate params={{ slug }} replace to="/$slug" />;
  }

  if (isOrgSetupPath(slug, location.pathname)) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <AuthenticatedTopbar left={<TeamSwitcherSlot />} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider className="!h-full !min-h-0 overflow-hidden bg-background">
      <AppSidebar orgSlug={slug} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AuthenticatedTopbar
          left={<SidebarTrigger className="size-11 rounded-xl lg:hidden" />}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function OrganizationHomeSkeleton({ slug }: { slug: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-24">
      <section className="w-full max-w-lg space-y-6">
        <Skeleton className="size-11 rounded-sm" />
        <div className="space-y-3">
          <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-3/4 max-w-md" />
        </div>
      </section>
    </main>
  );
}

function OrganizationNotFound({ slug }: { slug: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-24">
      <section className="w-full max-w-lg space-y-4">
        <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Team not found
        </h1>
        <p className="max-w-md text-muted-foreground text-sm leading-6">
          This team does not exist or your account does not have access.
        </p>
        <Button asChild variant="outline">
          <Link to="/account/teams/new">Create team</Link>
        </Button>
      </section>
    </main>
  );
}

function OrganizationActivationError({ slug }: { slug: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-24">
      <section className="w-full max-w-lg space-y-4">
        <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Team could not be opened
        </h1>
        <p className="max-w-md text-muted-foreground text-sm leading-6">
          Lightfast could not activate this team for your current session.
          Refresh the page or select the team again.
        </p>
        <Button asChild variant="outline">
          <Link to="/account/teams/new">Back to account</Link>
        </Button>
      </section>
    </main>
  );
}
