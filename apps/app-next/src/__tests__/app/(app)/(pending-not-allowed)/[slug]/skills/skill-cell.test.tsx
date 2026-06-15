import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "./fixtures";

const { SkillCell } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-cell"
);

describe("SkillCell", () => {
  it("renders the name and description and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <SkillCell
        onSelect={onSelect}
        skill={createSkill({ name: "Code Review", slug: "code-review" })}
      />
    );

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Review code changes")).toBeInTheDocument();
    expect(screen.queryByText("Invalid")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Code Review/i }));
    expect(onSelect).toHaveBeenCalledWith("code-review");
  });

  it("marks invalid skills", () => {
    render(
      <SkillCell
        onSelect={vi.fn()}
        skill={createSkill({ validationStatus: "invalid" })}
      />
    );

    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });
});
