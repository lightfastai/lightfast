import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createListData } from "./fixtures";

const listData = createListData();

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

const { SkillsActions } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-actions"
);

describe("SkillsActions", () => {
  it("renders the freshness status and a View Source link", () => {
    render(<SkillsActions />);

    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Source/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/.lightfast"
    );
  });
});
