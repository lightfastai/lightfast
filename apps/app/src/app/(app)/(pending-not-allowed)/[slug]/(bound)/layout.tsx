import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireOrgAccess } from "~/lib/org-access-clerk";
import { getOrgBindingGate } from "~/lib/org-binding-gate";

interface BoundLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Product setup gate.
 *
 * The parent `[slug]/layout.tsx` is the membership/slug access gate; this layer
 * gates on whether the org has completed source-control setup. It reads the
 * authoritative DB binding directly rather than trusting `auth().orgSlug` or
 * session claims — the `organizationSyncOptions` race is exactly why
 * `requireOrgAccess(slug)` (and, here, the DB gate) exists.
 */
export default async function BoundLayout({
  children,
  params,
}: BoundLayoutProps) {
  const { slug } = await params;
  const { org } = await requireOrgAccess(slug);
  const gate = await getOrgBindingGate(org.id);

  if (gate.bindingStatus !== "bound") {
    redirect(`/${slug}/tasks/bind` as Route);
  }

  return children;
}
