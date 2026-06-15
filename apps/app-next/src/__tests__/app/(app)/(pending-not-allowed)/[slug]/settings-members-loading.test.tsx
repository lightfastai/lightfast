import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { default: MembersLoading } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/loading"
);

describe("members settings loading", () => {
  it("renders only a centered loading spinner", () => {
    render(<MembersLoading />);

    const status = screen.getByRole("status", { name: "Loading members" });
    const spinner = status.querySelector("svg");

    expect(status).toHaveClass("flex");
    expect(spinner).toHaveClass("animate-spin");
    expect(status).toHaveTextContent(/^$/);
  });
});
