import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "../components/markdown-content";

const sourcePath = "skills/code-review/SKILL.md";
const sourceUrlBase =
  "https://github.com/acme/.lightfast/blob/abc/skills/code-review";

describe("MarkdownContent", () => {
  it("does not render raw html", async () => {
    render(
      await MarkdownContent({
        children: "<script>alert(1)</script>\n\n# Title",
        sourcePath,
        sourceUrlBase,
      })
    );

    expect(screen.getByText("Title")).not.toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("rewrites safe relative links to commit-pinned GitHub urls", async () => {
    render(
      await MarkdownContent({
        children: "[Notes](references/api.md)",
        sourcePath,
        sourceUrlBase,
      })
    );

    expect(
      screen.getByRole("link", { name: "Notes" }).getAttribute("href")
    ).toBe(
      "https://github.com/acme/.lightfast/blob/abc/skills/code-review/references/api.md"
    );
  });

  it("preserves query strings and hash fragments on safe relative links", async () => {
    render(
      await MarkdownContent({
        children: "[Notes](references/api.md?plain=1#setup)",
        sourcePath,
        sourceUrlBase,
      })
    );

    expect(
      screen.getByRole("link", { name: "Notes" }).getAttribute("href")
    ).toBe(
      "https://github.com/acme/.lightfast/blob/abc/skills/code-review/references/api.md?plain=1#setup"
    );
  });

  it("keeps malformed percent-encoded relative links inert", async () => {
    render(
      await MarkdownContent({
        children: "[Bad](references/%zz.md)",
        sourcePath,
        sourceUrlBase,
      })
    );

    expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
    expect(screen.getByText("Bad")).not.toBeNull();
  });

  it("keeps escaping relative links inert", async () => {
    render(
      await MarkdownContent({
        children: "[Other](../other/SKILL.md)",
        sourcePath,
        sourceUrlBase,
      })
    );

    expect(screen.queryByRole("link", { name: "Other" })).toBeNull();
    expect(screen.getByText("Other")).not.toBeNull();
  });

  it("renders image syntax as an inert reference", async () => {
    render(
      await MarkdownContent({
        children: "![Diagram](assets/flow.png)",
        sourcePath,
        sourceUrlBase,
      })
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/Image: Diagram/)).not.toBeNull();
  });
});
