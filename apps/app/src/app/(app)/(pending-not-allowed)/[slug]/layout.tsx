import { getActiveNamespaceByHandle } from "@db/app";
import { db } from "@db/app/client";
import {
  type OrgSetupGate,
  pathForSetupRequirement,
} from "@repo/app-setup-contract";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { ShellDataBoundary } from "~/components/shell-data-boundary";
import { getQueryClient, trpc } from "~/trpc/server";

const LIGHTFAST_PATHNAME_HEADER = "x-lightfast-pathname";
const ORG_SETUP_EXEMPT_PATH_SUFFIXES = [
  "/settings",
  "/tasks/bind",
  "/tasks/github/lightfast-repo",
  "/tasks/connectors/x",
] as const;

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Why we check access by slug through tRPC instead of auth().orgSlug:
 * after org name changes, setActive() updates cookies but there can be
 * propagation delay. The API layer resolves the org from the user's Clerk
 * memberships by slug and verifies access there.
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;
  const namespace = await resolveActiveNamespace(slug);

  if (namespace?.kind === "user") {
    const requestPathname = await getRequestPathname(namespace.handle);
    if (!isNamespaceRootPath(requestPathname, namespace.handle)) {
      log.debug("[org-layout] user namespace subroute denied", {
        handle: namespace.handle,
        pathname: requestPathname,
      });
      notFound();
    }

    return <UserNamespaceRoot handle={namespace.handle} />;
  }

  const orgSlug = namespace?.kind === "org" ? namespace.handle : slug;
  if (!namespace) {
    log.debug(
      "[org-layout] namespace missing; falling back to Clerk org slug",
      {
        slug,
      }
    );
  }

  let orgAccess: OrgSetupGate;
  try {
    orgAccess = await getQueryClient().fetchQuery(
      trpc.viewer.organization.getBySlug.queryOptions({
        slug: orgSlug,
      })
    );
  } catch (error) {
    log.debug("[org-layout] access denied", {
      error: parseError(error),
      slug: orgSlug,
    });
    notFound();
  }

  const requestPathname = await getRequestPathname(orgSlug);
  const setupRedirectPath = getSetupRedirectPath({
    gate: orgAccess,
    orgSlug,
    pathname: requestPathname,
  });
  if (setupRedirectPath) {
    redirect(setupRedirectPath);
  }

  return (
    <ShellDataBoundary>
      <OrgPageErrorBoundary orgSlug={orgSlug}>{children}</OrgPageErrorBoundary>
    </ShellDataBoundary>
  );
}

async function resolveActiveNamespace(slug: string) {
  try {
    return await getActiveNamespaceByHandle(db, slug);
  } catch (error) {
    log.debug("[org-layout] namespace lookup failed", {
      error: parseError(error),
      slug,
    });
    return;
  }
}

async function getRequestPathname(handle: string) {
  const requestHeaders = await headers();
  return requestHeaders.get(LIGHTFAST_PATHNAME_HEADER) ?? `/${handle}`;
}

function isNamespaceRootPath(pathname: string, handle: string) {
  return pathname === `/${handle}` || pathname === `/${handle}/`;
}

function isSetupExemptOrgPath(pathname: string, orgSlug: string) {
  const orgRoot = `/${orgSlug}`;
  return ORG_SETUP_EXEMPT_PATH_SUFFIXES.some((suffix) => {
    const path = `${orgRoot}${suffix}`;
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

function getSetupRedirectPath(input: {
  gate: OrgSetupGate;
  orgSlug: string;
  pathname: string;
}) {
  if (
    input.gate.bindingStatus === "bound" ||
    isSetupExemptOrgPath(input.pathname, input.orgSlug)
  ) {
    return null;
  }

  return pathForSetupRequirement({
    orgSlug: input.orgSlug,
    requirement: input.gate.nextSetupRequirement,
  });
}

function UserNamespaceRoot({ handle }: { handle: string }) {
  return (
    <main className="flex h-full min-h-0 w-full items-center justify-center bg-background px-6 py-10">
      <section className="w-full max-w-xl">
        <p className="font-medium text-muted-foreground text-sm">
          Lightfast user
        </p>
        <h1 className="mt-3 font-semibold text-3xl text-foreground">
          @{handle}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm">
          This handle is reserved in the shared Lightfast namespace.
        </p>
      </section>
    </main>
  );
}
