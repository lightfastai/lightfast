import { describe, expect, it } from "vitest";
import { getRepositoryBlobUrl } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown";

describe("skill markdown links", () => {
  it("encodes repository blob path segments", () => {
    expect(
      getRepositoryBlobUrl({
        commitSha: "abc123",
        path: "skills/code review/references/a#b.md",
        repositoryUrl: "https://github.com/acme/.lightfast/",
      })
    ).toBe(
      "https://github.com/acme/.lightfast/blob/abc123/skills/code%20review/references/a%23b.md"
    );
  });
});
