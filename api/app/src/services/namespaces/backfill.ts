import {
  backfillExistingNamespace,
  type Database,
  NamespaceConflictError,
} from "@db/app";
import { lightfastHandleSchema } from "@repo/app-validation";

const CLERK_PAGE_LIMIT = 100;

interface ClerkUserForNamespaceBackfill {
  id: string;
  username?: string | null;
}

interface ClerkOrganizationForNamespaceBackfill {
  id: string;
  slug?: string | null;
}

interface ClerkPage<T> {
  data: T[];
  totalCount?: number;
}

interface NamespaceBackfillClerkClient {
  organizations: {
    getOrganizationList(input: {
      limit: number;
      offset: number;
    }): Promise<ClerkPage<ClerkOrganizationForNamespaceBackfill>>;
  };
  users: {
    getUserList(input: {
      limit: number;
      offset: number;
    }): Promise<ClerkPage<ClerkUserForNamespaceBackfill>>;
  };
}

export interface NamespaceBackfillStats {
  alreadyActive: number;
  backfilled: number;
  conflicts: number;
  scanned: number;
  skipped: number;
}

export interface ClerkNamespaceBackfillResult {
  orgs: NamespaceBackfillStats;
  users: NamespaceBackfillStats;
}

export function hasNamespaceBackfillConflicts(
  result: ClerkNamespaceBackfillResult
) {
  return result.orgs.conflicts > 0 || result.users.conflicts > 0;
}

export async function backfillClerkNamespaces(input: {
  clerk: NamespaceBackfillClerkClient;
  db: Database;
}): Promise<ClerkNamespaceBackfillResult> {
  const users = createStats();
  await pageClerkResources({
    fetchPage: (pagination) => input.clerk.users.getUserList(pagination),
    onItem: async (user) => {
      users.scanned += 1;

      const handle = parseBackfillHandle(user.username);
      if (!handle) {
        users.skipped += 1;
        return;
      }

      try {
        const result = await backfillExistingNamespace(input.db, {
          clerkUserId: user.id,
          handle,
          kind: "user",
        });
        incrementBackfillStats(users, result.status);
      } catch (error) {
        if (error instanceof NamespaceConflictError) {
          users.conflicts += 1;
          return;
        }
        throw error;
      }
    },
  });

  const orgs = createStats();
  await pageClerkResources({
    fetchPage: (pagination) =>
      input.clerk.organizations.getOrganizationList(pagination),
    onItem: async (org) => {
      orgs.scanned += 1;

      const handle = parseBackfillHandle(org.slug);
      if (!handle) {
        orgs.skipped += 1;
        return;
      }

      try {
        const result = await backfillExistingNamespace(input.db, {
          clerkOrgId: org.id,
          handle,
          kind: "org",
        });
        incrementBackfillStats(orgs, result.status);
      } catch (error) {
        if (error instanceof NamespaceConflictError) {
          orgs.conflicts += 1;
          return;
        }
        throw error;
      }
    },
  });

  return { orgs, users };
}

function createStats(): NamespaceBackfillStats {
  return {
    alreadyActive: 0,
    backfilled: 0,
    conflicts: 0,
    scanned: 0,
    skipped: 0,
  };
}

function incrementBackfillStats(
  stats: NamespaceBackfillStats,
  status: "already_active" | "backfilled"
) {
  if (status === "already_active") {
    stats.alreadyActive += 1;
    return;
  }

  stats.backfilled += 1;
}

function parseBackfillHandle(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = lightfastHandleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function pageClerkResources<T>(input: {
  fetchPage: (pagination: {
    limit: number;
    offset: number;
  }) => Promise<ClerkPage<T>>;
  onItem: (item: T) => Promise<void>;
}) {
  let offset = 0;

  for (;;) {
    const page = await input.fetchPage({
      limit: CLERK_PAGE_LIMIT,
      offset,
    });

    for (const item of page.data) {
      await input.onItem(item);
    }

    offset += page.data.length;

    if (page.data.length < CLERK_PAGE_LIMIT) {
      return;
    }

    if (typeof page.totalCount === "number" && offset >= page.totalCount) {
      return;
    }
  }
}
