import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const { DEV_MOCK_LIST } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-dev-data"
);

beforeEach(() => {
  listData = createListData();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("useSkillsList", () => {
  it("returns the real query result when skills exist", () => {
    listData = createListData({ skills: [createSkill({ slug: "real" })] });

    const { result } = renderHook(() => useSkillsList());

    expect(result.current.skills).toHaveLength(1);
    expect(result.current.skills[0]?.slug).toBe("real");
  });

  it("falls back to dev mock data only when empty in development", () => {
    listData = createListData({ skills: [] });
    vi.stubEnv("NODE_ENV", "development");

    const { result } = renderHook(() => useSkillsList());

    expect(result.current.skills).toHaveLength(DEV_MOCK_LIST.skills.length);
  });

  it("does not use dev mock data outside development", () => {
    listData = createListData({ skills: [] });
    vi.stubEnv("NODE_ENV", "production");

    const { result } = renderHook(() => useSkillsList());

    expect(result.current.skills).toHaveLength(0);
  });
});
