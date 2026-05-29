export function normalizeTeamSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function renameOrganizationSlug<T extends { slug: string }>(
  organizations: T[] | undefined,
  {
    name,
    slug,
  }: {
    name: string;
    slug: string;
  }
) {
  return organizations?.map((organization) =>
    organization.slug === slug ? { ...organization, slug: name } : organization
  );
}
