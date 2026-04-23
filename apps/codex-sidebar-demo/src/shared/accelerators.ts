export const ACCELERATORS = {
  archiveThread: "CmdOrCtrl+Shift+A",
  copyConversationPath: "CmdOrCtrl+Alt+Shift+C",
  copyDeeplink: "CmdOrCtrl+Alt+L",
  copySessionId: "CmdOrCtrl+Alt+C",
  copyWorkingDirectory: "CmdOrCtrl+Shift+C",
  dictation: "Ctrl+M",
  findInThread: "CmdOrCtrl+F",
  navigateBack: "CmdOrCtrl+[",
  navigateForward: "CmdOrCtrl+]",
  newThread: "CmdOrCtrl+N",
  newThreadAlt: "CmdOrCtrl+Shift+O",
  newWindow: "CmdOrCtrl+Shift+N",
  nextThread: "CmdOrCtrl+Shift+]",
  openCommandMenu: "CmdOrCtrl+Shift+P",
  openCommandMenuAlt: "CmdOrCtrl+K",
  openFolder: "CmdOrCtrl+O",
  previousThread: "CmdOrCtrl+Shift+[",
  quickChat: "CmdOrCtrl+Alt+N",
  renameThread: "Command+Control+R",
  searchChats: "CmdOrCtrl+G",
  searchFiles: "CmdOrCtrl+P",
  settings: "CmdOrCtrl+,",
  toggleBrowserPanel: "CmdOrCtrl+Shift+B",
  toggleDiffPanel: "CmdOrCtrl+Alt+B",
  toggleFileTreePanel: "Command+Shift+E",
  toggleSidebar: "CmdOrCtrl+B",
  toggleTerminal: "CmdOrCtrl+J",
  toggleThreadPin: "CmdOrCtrl+Alt+P",
  toggleTraceRecording: "CmdOrCtrl+Shift+S",
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
