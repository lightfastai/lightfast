import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "./fixtures";

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown",
  () => ({
    SkillMarkdown: () => <div>Markdown preview</div>,
    getSkillSourceUrl: () =>
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md",
  })
);

const { SkillDialog } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-dialog"
);

describe("SkillDialog", () => {
  it("renders the skill content with a source link", () => {
    render(
      <SkillDialog
        onOpenChange={vi.fn()}
        repositoryUrl="https://github.com/acme/.lightfast"
        skill={createSkill({ name: "Code Review" })}
      />
    );

    expect(
      screen.getByRole("heading", { name: /Code Review/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Skill")).toBeInTheDocument();
    expect(screen.getByText("Review code changes")).toBeInTheDocument();
    expect(screen.getByText("Markdown preview")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View source/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md"
    );
  });

  it("surfaces diagnostics for invalid skills", () => {
    render(
      <SkillDialog
        onOpenChange={vi.fn()}
        repositoryUrl="https://github.com/acme/.lightfast"
        skill={createSkill({
          diagnostics: [
            {
              code: "frontmatter_missing",
              message: "Skill file must begin with YAML frontmatter.",
              severity: "error",
            },
          ],
          validationStatus: "invalid",
        })}
      />
    );

    expect(screen.getByText("1 diagnostic")).toBeInTheDocument();
    expect(
      screen.getByText("Skill file must begin with YAML frontmatter.")
    ).toBeInTheDocument();
  });

  it("renders nothing when no skill is selected", () => {
    render(
      <SkillDialog
        onOpenChange={vi.fn()}
        repositoryUrl="https://github.com/acme/.lightfast"
        skill={undefined}
      />
    );

    expect(screen.queryByText("Skill")).not.toBeInTheDocument();
  });
});
