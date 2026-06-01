import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useInlineEdit } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit";

function changeEvent(value: string) {
  return { target: { value } } as unknown as ChangeEvent<HTMLInputElement>;
}

function keyEvent(
  over: Partial<{
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
  }>
) {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...over,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe("useInlineEdit", () => {
  it("begins editing and seeds the draft from value", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    expect(result.current.editing).toBe(false);
    act(() => result.current.begin());
    expect(result.current.editing).toBe(true);
    expect(result.current.draft).toBe("Hello");
  });

  it("commits the trimmed draft on blur and exits editing", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("  World  ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).toHaveBeenCalledWith("World");
    expect(result.current.editing).toBe(false);
  });

  it("does not commit when the trimmed draft is unchanged", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("  Hello  ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when the draft is empty", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("   ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on Enter when single-line", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("Renamed")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter" })));

    expect(onCommit).toHaveBeenCalledWith("Renamed");
  });

  it("commits only on Cmd/Ctrl+Enter when multiline", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", multiline: true, onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("New body")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter" })));
    expect(onCommit).not.toHaveBeenCalled();

    act(() =>
      result.current.fieldProps.onKeyDown(
        keyEvent({ key: "Enter", metaKey: true })
      )
    );
    expect(onCommit).toHaveBeenCalledWith("New body");
  });

  it("cancels on Escape without committing and resets the draft", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("Discard me")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Escape" })));

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
    expect(result.current.draft).toBe("Hello");
  });

  it("suppresses the trailing blur after Escape (no double-handle)", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("Changed")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Escape" })));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });
});
