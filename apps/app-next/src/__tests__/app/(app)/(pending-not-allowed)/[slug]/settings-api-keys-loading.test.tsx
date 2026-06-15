import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { default: ApiKeysLoading } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/loading"
);

describe("api keys settings loading", () => {
  it("renders only a centered loading spinner", () => {
    render(<ApiKeysLoading />);

    const status = screen.getByRole("status", { name: "Loading API keys" });
    const spinner = status.querySelector("svg");

    expect(status).toHaveClass("flex");
    expect(spinner).toHaveClass("animate-spin");
    expect(status).toHaveTextContent("");
  });
});
