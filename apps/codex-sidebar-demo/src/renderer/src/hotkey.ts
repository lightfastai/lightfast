import {
  type AcceleratorName,
  ACCELERATORS,
  type FormatPlatform,
} from "../../shared/accelerators";

interface ParsedAccelerator {
  codeCandidates: string[];
  key: string;
  requireAlt: boolean;
  requireCtrl: boolean;
  requireMeta: boolean;
  requireShift: boolean;
}

function keyCodes(key: string): string[] {
  switch (key) {
    case ".":
      return ["Period"];
    case ",":
      return ["Comma"];
    case "/":
      return ["Slash"];
    case "\\":
      return ["Backslash"];
    case "[":
      return ["BracketLeft"];
    case "]":
      return ["BracketRight"];
    case ";":
      return ["Semicolon"];
    case "'":
      return ["Quote"];
    case "-":
      return ["Minus"];
    case "=":
      return ["Equal"];
    case "`":
      return ["Backquote"];
    case "space":
      return ["Space"];
    case "plus":
      return ["Equal", "NumpadAdd"];
    default:
      return [];
  }
}

function parse(
  accelerator: string,
  platform: FormatPlatform
): ParsedAccelerator {
  const isMac = platform === "darwin";
  const parts = accelerator.split("+").filter(Boolean);
  let key = "";
  let codeCandidates: string[] = [];
  let requireCtrl = false;
  let requireMeta = false;
  let requireAlt = false;
  let requireShift = false;

  for (const part of parts) {
    switch (part) {
      case "CmdOrCtrl":
        if (isMac) requireMeta = true;
        else requireCtrl = true;
        break;
      case "Command":
      case "Cmd":
        requireMeta = true;
        break;
      case "Control":
      case "Ctrl":
        requireCtrl = true;
        break;
      case "Alt":
      case "Option":
        requireAlt = true;
        break;
      case "Shift":
        requireShift = true;
        break;
      default:
        key = part.toLowerCase();
        codeCandidates = keyCodes(part);
        break;
    }
  }

  return {
    codeCandidates,
    key,
    requireAlt,
    requireCtrl,
    requireMeta,
    requireShift,
  };
}

function matches(event: KeyboardEvent, spec: ParsedAccelerator): boolean {
  if (!spec.key) return false;
  const keyHit =
    event.key.toLowerCase() === spec.key ||
    spec.codeCandidates.includes(event.code);
  if (!keyHit) return false;
  if (event.ctrlKey !== spec.requireCtrl) return false;
  if (event.metaKey !== spec.requireMeta) return false;
  if (event.altKey !== spec.requireAlt) return false;
  if (event.shiftKey !== spec.requireShift) return false;
  return true;
}

export type HotkeyHandler = (event: KeyboardEvent) => void;

export interface HotkeyManagerOptions {
  platform: FormatPlatform;
}

export function createHotkeyManager(options: HotkeyManagerOptions) {
  const handlers = new Map<AcceleratorName, Set<HotkeyHandler>>();
  const specs = new Map<AcceleratorName, ParsedAccelerator>();

  for (const name of Object.keys(ACCELERATORS) as AcceleratorName[]) {
    specs.set(name, parse(ACCELERATORS[name], options.platform));
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    for (const [name, spec] of specs) {
      if (!matches(event, spec)) continue;
      const set = handlers.get(name);
      if (!set || set.size === 0) continue;
      event.preventDefault();
      for (const handler of set) {
        handler(event);
      }
      return;
    }
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  return {
    dispose(): void {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      handlers.clear();
    },
    on(name: AcceleratorName, handler: HotkeyHandler): () => void {
      let set = handlers.get(name);
      if (!set) {
        set = new Set();
        handlers.set(name, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
      };
    },
  };
}
