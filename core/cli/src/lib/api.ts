import { getBaseUrl } from "./config.js";

interface Organization {
  id: string;
  name: string;
  role: string;
  slug: string;
}

export async function listOrganizations(jwt: string): Promise<Organization[]> {
  const res = await fetch(`${getBaseUrl()}/api/cli/login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(`Failed to list organizations: ${res.status}`);
  }
  const data = (await res.json()) as { organizations: Organization[] };
  return data.organizations;
}

export async function setupOrg(
  jwt: string,
  orgId: string
): Promise<{
  apiKey: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
}> {
  const res = await fetch(`${getBaseUrl()}/api/cli/setup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orgId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to setup organization: ${res.status}`);
  }
  return res.json() as Promise<{
    apiKey: string;
    orgId: string;
    orgSlug: string;
    orgName: string;
  }>;
}

export function getStreamUrl(): string {
  return `${getBaseUrl()}/api/gateway/stream`;
}
