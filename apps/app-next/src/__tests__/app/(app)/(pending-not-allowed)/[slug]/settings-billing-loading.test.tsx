import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { default: BillingLoading } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/loading"
);

describe("billing settings loading", () => {
  it("renders only a centered loading spinner", () => {
    render(<BillingLoading />);

    const status = screen.getByRole("status", { name: "Loading billing" });
    const spinner = status.querySelector("svg");

    expect(status).toHaveClass("flex");
    expect(spinner).toHaveClass("animate-spin");
    expect(status).toHaveTextContent("");
  });
});
