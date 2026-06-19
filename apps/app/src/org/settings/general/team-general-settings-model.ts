import type { UserOrganizationsData } from "~/organization/organization-cache";

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeTeamSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTeamDomainInput(value: string) {
  const trimmed = value.trim().toLowerCase();
  const withoutEmailLocalPart = trimmed.includes("@")
    ? (trimmed.split("@").at(-1) ?? "")
    : trimmed;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutEmailLocalPart)
    ? withoutEmailLocalPart
    : `https://${withoutEmailLocalPart}`;

  let hostname = "";
  try {
    hostname = new URL(withProtocol).hostname;
  } catch {
    hostname = withoutEmailLocalPart.split(/[/?#]/, 1)[0] ?? "";
  }

  return hostname
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function parseTeamDomainInput(value: string) {
  const domains = value
    .split(/[\s,;]+/)
    .map(normalizeTeamDomainInput)
    .filter((domain) => DOMAIN_PATTERN.test(domain));

  return [...new Set(domains)];
}

export function normalizeTeamDomainList(domains: string[]) {
  return [...new Set(domains.flatMap(parseTeamDomainInput))];
}

export function renameOrganizationSlug(
  organizations: UserOrganizationsData | undefined,
  {
    name,
    slug,
  }: {
    name: string;
    slug: string;
  }
) {
  return organizations?.map((organization) =>
    organization.slug === slug
      ? { ...organization, name, slug: name }
      : organization
  );
}
