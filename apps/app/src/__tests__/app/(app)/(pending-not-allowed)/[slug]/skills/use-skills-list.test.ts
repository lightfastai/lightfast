import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListData, createSkill } from "./fixtures";

let listData = createListData();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        skills: {
          list: {
            queryOptions: () => ({
              queryKey: ["org", "workspace", "skills", "list"],
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: listData }),
}));

const { useSkillsList } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skills-list"
);

beforeEach(() => {
  listData = createListData();
});

describe("useSkillsList", () => {
  it("returns the real query result when skills exist", () => {
    listData = createListData({ skills: [createSkill({ slug: "real" })] });

    const { result } = renderHook(() => useSkillsList());

    expect(result.current.skills).toHaveLength(1);
    expect(result.current.skills[0]?.slug).toBe("real");
  });

  it("returns an empty list when the org has no indexed skills", () => {
    listData = createListData({ skills: [] });

    const { result } = renderHook(() => useSkillsList());

    expect(result.current.skills).toHaveLength(0);
  });
});
