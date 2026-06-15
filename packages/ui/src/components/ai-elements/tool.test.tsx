// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToolInput, ToolOutput } from "./tool";

describe("Tool payload rendering", () => {
  it("renders BigInt payloads without throwing", () => {
    expect(() => render(<ToolInput input={1n} />)).not.toThrow();

    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders circular output payloads without throwing", () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(() =>
      render(<ToolOutput errorText={undefined} output={value} />)
    ).not.toThrow();

    expect(screen.getByText("[object Object]")).toBeTruthy();
  });
});
