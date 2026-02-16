// Mapped from globals.css .dark {} variables (oklch → hex via proper conversion)
export const COLORS = {
  background: "#1a1a1a",       // --background: oklch(0.2178 0 0)
  cardWhite: "#202020",        // --card: oklch(0.2435 0 0)
  cardGray: "#242424",         // --accent: oklch(0.26 0 0)
  border: "#353535",           // --border: oklch(0.329 0 0)
  borderLight: "#303030",      // --secondary: oklch(0.3092 0 0)
  text: "#d9d9d9",             // --foreground: oklch(0.8853 0 0)
  textMuted: "#808080",        // --muted-foreground: oklch(0.5999 0 0)
  textLight: "#555555",
  primary: "#ffffff",          // --primary: oklch(1 0 0)
  primaryAccent: "#ef4444",
  connectionLine: "#353535",   // matches --border
  connectionParticle: "#808080",
  tableHeader: "#242424",      // matches cardGray/accent
  tableRowAlt: "#222222",
} as const;
