export const ACCELERATORS = {
  newThread: "CmdOrCtrl+N",
  newWindow: "CmdOrCtrl+Shift+N",
  settings: "CmdOrCtrl+,",
  toggleSidebar: "CmdOrCtrl+B",
} as const;

export type AcceleratorName = keyof typeof ACCELERATORS;

export type FormatPlatform = "darwin" | "linux" | "win32";

const MAC_SYMBOLS: Record<string, string> = {
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Command: "⌘",
};

const MAC_MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Command"] as const;
const OTHER_MODIFIER_ORDER = [
  "Ctrl",
  "Alt",
  "Shift",
  "Cmd",
  "Super",
  "Win",
] as const;

export function formatAccelerator(
  accelerator: string,
  platform: FormatPlatform = "darwin"
): string {
  const isMac = platform === "darwin";
  const isLinux = platform === "linux";
  const parts = accelerator.split("+").filter(Boolean);
  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const part of parts) {
    switch (part) {
      case "CmdOrCtrl":
        modifiers.add(isMac ? "Command" : "Ctrl");
        break;
      case "Command":
      case "Cmd":
        modifiers.add(isMac ? "Command" : isLinux ? "Super" : "Win");
        break;
      case "Control":
      case "Ctrl":
        modifiers.add("Ctrl");
        break;
      case "Alt":
      case "Option":
        modifiers.add("Alt");
        break;
      case "Shift":
        modifiers.add("Shift");
        break;
      default:
        key = part;
        break;
    }
  }

  const keyOut = isMac && key === "Plus" ? "+" : (key ?? "");

  if (isMac) {
    const prefix = MAC_MODIFIER_ORDER.filter((m) => modifiers.has(m))
      .map((m) => MAC_SYMBOLS[m])
      .join("");
    return `${prefix}${keyOut}`;
  }

  const collected = Array.from(modifiers).map((m) =>
    m === "Command" ? "Cmd" : m
  );
  const ordered = OTHER_MODIFIER_ORDER.filter((m) => collected.includes(m));
  return [...ordered, keyOut].filter(Boolean).join("+");
}

export function resolveAccelerator(name: AcceleratorName): string {
  return ACCELERATORS[name];
}
