import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListData, createSkill } from "./fixtures";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));

let listData = createListData();

let skillParam: string | null = null;
const setSkillParamMock = vi.fn((next: string | null) => {
  skillParam = next;
});

vi.mock("nuqs", () => ({
  useQueryState: () => [skillParam, setSkillParamMock] as const,
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        skills: { list: { queryOptions: listQueryOptionsMock } },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: listData }),
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown",
  () => ({
    SkillMarkdown: () => <div>Markdown preview</div>,
    getSkillSourceUrl: () =>
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md",
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/lf-select",
  () => ({
    LfSelect: ({
      "aria-label": ariaLabel,
      onValueChange,
      options,
      value,
    }: {
      "aria-label"?: string;
      onValueChange?: (value: string) => void;
      options: { label: string; value: string }[];
      value?: string;
    }) => (
      <select
        aria-label={ariaLabel}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  })
);

const { SkillsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client"
);

beforeEach(() => {
  listData = createListData();
  skillParam = null;
  setSkillParamMock.mockClear();
  listQueryOptionsMock.mockClear();
});

describe("SkillsClient", () => {
  it("renders the hero and a Team grid cell per skill", () => {
    render(<SkillsClient />);

    expect(
      screen.getByRole("heading", { name: "Make Lightfast work your way" })
    ).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("code-review")).toBeInTheDocument();
  });

  it("filters to a no-match empty state when the search misses", () => {
    render(<SkillsClient />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search skills" }), {
      target: { value: "does-not-match" },
    });

    expect(screen.getByText("No matching skills.")).toBeInTheDocument();
    expect(screen.queryByText("No skills indexed.")).not.toBeInTheDocument();
  });

  it("shows the indexed empty state only when the index has no skills", () => {
    listData = createListData({ skills: [] });

    render(<SkillsClient />);

    expect(screen.getByText("No skills indexed.")).toBeInTheDocument();
  });

  it("marks invalid skills in the grid", () => {
    listData = createListData({
      skills: [createSkill({ slug: "broken", validationStatus: "invalid" })],
    });

    render(<SkillsClient />);

    // Scope to the grid badge; the filter dropdown also offers an "Invalid" option.
    expect(
      screen.getByText("Invalid", { selector: "span" })
    ).toBeInTheDocument();
  });

  it("filters the grid by validation status", () => {
    listData = createListData({
      skills: [
        createSkill({ name: "valid-skill", slug: "valid-skill" }),
        createSkill({
          name: "broken-skill",
          slug: "broken-skill",
          validationStatus: "invalid",
        }),
      ],
    });

    render(<SkillsClient />);

    expect(screen.getByText("valid-skill")).toBeInTheDocument();
    expect(screen.getByText("broken-skill")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter skills" }), {
      target: { value: "valid" },
    });

    expect(screen.getByText("valid-skill")).toBeInTheDocument();
    expect(screen.queryByText("broken-skill")).not.toBeInTheDocument();
  });

  it("opens the dialog by setting the skill query param", () => {
    render(<SkillsClient />);

    fireEvent.click(screen.getByRole("button", { name: /code-review/i }));

    expect(setSkillParamMock).toHaveBeenCalledWith("code-review");
  });

  it("renders the dialog for the skill named in the query param", () => {
    skillParam = "code-review";

    render(<SkillsClient />);

    expect(
      screen.getByRole("heading", { name: /code-review/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Markdown preview")).toBeInTheDocument();
  });
});
