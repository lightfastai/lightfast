import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));
const prefetchMock = vi.fn();
const hydrateClientMock = vi.fn(({ children }: { children?: ReactNode }) => (
  <div data-testid="hydrated-skills">{children}</div>
));

vi.mock("~/trpc/server", () => ({
  HydrateClient: hydrateClientMock,
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        skills: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client",
  () => ({
    SkillsClient: () => <h1>Skills</h1>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-loading",
  () => ({
    SkillsLoading: () => <div>Loading skills</div>,
  })
);

const { default: SkillsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/page"
);

beforeEach(() => {
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
  hydrateClientMock.mockClear();
});

describe("skills page", () => {
  it("prefetches skills and renders the skills client", () => {
    render(SkillsPage());

    expect(listQueryOptionsMock).toHaveBeenCalledWith(undefined, {
      staleTime: 0,
    });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "skills", "list"],
    });
    expect(
      prefetchMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    ).toBeLessThan(
      hydrateClientMock.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY
    );
    expect(screen.getByRole("heading", { name: "Skills" })).toBeVisible();
  });
});
