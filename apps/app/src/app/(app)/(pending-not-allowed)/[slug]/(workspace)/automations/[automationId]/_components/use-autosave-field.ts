import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

interface UseAutosaveFieldOptions {
  /** When true, the commit chord is Cmd/Ctrl+Enter and plain Enter inserts a newline. */
  multiline?: boolean;
  /** Called with the trimmed draft when a real change is committed. */
  onCommit: (next: string) => void;
  /** Current persisted value — source of truth for revert and change detection. */
  value: string;
}

export interface AutosaveFieldProps {
  onBlur: () => void;
  onChange: (event: ChangeEvent<EditableElement>) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<EditableElement>) => void;
  value: string;
}

export interface UseAutosaveFieldResult {
  draft: string;
  fieldProps: AutosaveFieldProps;
}

/**
 * Always-editable field with autosave. The control is never swapped in or out —
 * it commits the trimmed draft on blur and on the commit chord (Enter, or
 * Cmd/Ctrl+Enter when multiline), and reverts on Escape. While the field is not
 * focused it stays in sync with the persisted value, so an external update (or
 * an optimistic write) reflows the draft without clobbering an in-progress edit.
 */
export function useAutosaveField({
  value,
  multiline = false,
  onCommit,
}: UseAutosaveFieldOptions): UseAutosaveFieldResult {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  // Set before any programmatic blur (Escape / commit chord) so the trailing
  // blur event does not commit a second time.
  const suppressBlur = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDraft(value);
    }
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) {
      setDraft(value);
      return;
    }
    onCommit(trimmed);
  }

  function handleBlur() {
    focused.current = false;
    if (suppressBlur.current) {
      suppressBlur.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<EditableElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      suppressBlur.current = true;
      setDraft(value);
      event.currentTarget.blur();
      return;
    }
    const isCommitChord = multiline
      ? event.key === "Enter" && (event.metaKey || event.ctrlKey)
      : event.key === "Enter" && !event.shiftKey;
    if (isCommitChord) {
      event.preventDefault();
      suppressBlur.current = true;
      commit();
      event.currentTarget.blur();
    }
  }

  return {
    draft,
    fieldProps: {
      value: draft,
      onChange: (event) => setDraft(event.target.value),
      onFocus: () => {
        focused.current = true;
      },
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  };
}
