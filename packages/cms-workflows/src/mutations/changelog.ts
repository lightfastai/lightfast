import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

/**
 * Input type for creating a changelog entry via BaseHub mutation.
 * Maps to ChangelogPagesItem schema fields.
 */
export type ChangelogEntryInput = {
  /** Main title displayed in changelog list (e.g., "Neural Memory Foundation") */
  title: string;
  /** Version slug for URL (e.g., "0-2" -> /changelog/0-2) */
  slug: string;
  /** Main content as markdown - rendered via RichText */
  body: string;
  /** Bullet list of improvements (plain text, newline-separated) */
  improvements?: string;
  /** Bullet list of infrastructure changes */
  infrastructure?: string;
  /** Bullet list of bug fixes */
  fixes?: string;
  /** Bullet list of patches */
  patches?: string;
};

const getMutationClient = () => {
  return basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
};

/**
 * Create a new changelog entry in BaseHub.
 * Requires BASEHUB_ADMIN_TOKEN environment variable.
 */
export async function createChangelogEntry(data: ChangelogEntryInput) {
  const client = getMutationClient();

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Create changelog: ${data.title}`,
        data: {
          type: "create",
          _table: "changelogPages",
          _title: data.title,
          slug: data.slug,
          body: {
            type: "rich-text",
            markdown: data.body,
          },
          improvements: data.improvements ?? null,
          infrastructure: data.infrastructure ?? null,
          fixes: data.fixes ?? null,
          patches: data.patches ?? null,
        },
      },
      message: true,
      status: true,
    },
  });
}

/**
 * Update an existing changelog entry.
 */
export async function updateChangelogEntry(
  entryId: string,
  data: Partial<ChangelogEntryInput>,
) {
  const client = getMutationClient();

  const updateData: Record<string, unknown> = {
    type: "update",
    id: entryId,
  };

  if (data.title) updateData._title = data.title;
  if (data.slug) updateData.slug = data.slug;
  if (data.body) {
    updateData.body = { type: "rich-text", markdown: data.body };
  }
  if (data.improvements !== undefined)
    updateData.improvements = data.improvements;
  if (data.infrastructure !== undefined)
    updateData.infrastructure = data.infrastructure;
  if (data.fixes !== undefined) updateData.fixes = data.fixes;
  if (data.patches !== undefined) updateData.patches = data.patches;

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Update changelog: ${data.title ?? entryId}`,
        data: updateData,
      },
      message: true,
      status: true,
    },
  });
}
