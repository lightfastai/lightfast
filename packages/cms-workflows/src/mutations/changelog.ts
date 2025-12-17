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
 * Get the changelogPages collection ID for use as parentId in create mutations.
 */
async function getChangelogCollectionId(): Promise<string> {
  const client = getMutationClient();
  const result = await client.query({
    changelogPages: {
      _id: true,
    },
  });
  return (result as { changelogPages: { _id: string } }).changelogPages._id;
}

/**
 * Create a new changelog entry in BaseHub.
 * Requires BASEHUB_ADMIN_TOKEN environment variable.
 */
export async function createChangelogEntry(data: ChangelogEntryInput) {
  const client = getMutationClient();
  const parentId = await getChangelogCollectionId();

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Create changelog: ${data.title}`,
        data: [{
          type: "create",
          parentId: parentId,
          data: {
            type: "instance",
            title: data.title,
            slug: data.slug,
            value: {
              body: {
                type: "rich-text",
                value: {
                  format: "markdown",
                  value: data.body,
                },
              },
              improvements: {
                type: "text",
                value: data.improvements ?? null,
              },
              infrastructure: {
                type: "text",
                value: data.infrastructure ?? null,
              },
              fixes: {
                type: "text",
                value: data.fixes ?? null,
              },
              patches: {
                type: "text",
                value: data.patches ?? null,
              },
            },
          },
        }],
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

  const valueUpdates: Record<string, unknown> = {};

  if (data.body) {
    valueUpdates.body = {
      type: "rich-text",
      value: { format: "markdown", value: data.body },
    };
  }
  if (data.improvements !== undefined) {
    valueUpdates.improvements = { type: "text", value: data.improvements };
  }
  if (data.infrastructure !== undefined) {
    valueUpdates.infrastructure = { type: "text", value: data.infrastructure };
  }
  if (data.fixes !== undefined) {
    valueUpdates.fixes = { type: "text", value: data.fixes };
  }
  if (data.patches !== undefined) {
    valueUpdates.patches = { type: "text", value: data.patches };
  }

  const updateData: Record<string, unknown> = {
    type: "update",
    id: entryId,
  };

  if (data.title) updateData.title = data.title;
  if (data.slug) updateData.slug = data.slug;
  if (Object.keys(valueUpdates).length > 0) {
    updateData.value = valueUpdates;
  }

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Update changelog: ${data.title ?? entryId}`,
        data: [updateData],
      },
      message: true,
      status: true,
    },
  });
}
