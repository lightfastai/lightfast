import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "./fixtures";

const { SkillGrid } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-grid"
);

describe("SkillGrid", () => {
  it("renders the Team header with the visible count and one cell per skill", () => {
    render(
      <SkillGrid
        emptyState="No matching skills."
        onSelect={vi.fn()}
        skills={[
          createSkill({ name: "Alpha", slug: "alpha" }),
          createSkill({ name: "Bravo", slug: "bravo" }),
        ]}
      />
    );

    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("forwards the selected slug", () => {
    const onSelect = vi.fn();
    render(
      <SkillGrid
        emptyState="No matching skills."
        onSelect={onSelect}
        skills={[createSkill({ name: "Alpha", slug: "alpha" })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Alpha/i }));
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("renders the empty state when there are no skills", () => {
    render(
      <SkillGrid emptyState="No skills indexed." onSelect={vi.fn()} skills={[]} />
    );

    expect(screen.getByText("No skills indexed.")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
