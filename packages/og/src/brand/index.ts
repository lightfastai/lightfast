export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Dark mode colors from packages/ui/src/globals.css (.dark)
 * Converted from oklch to hex for Satori compatibility.
 */
export const colors = {
	// .dark theme tokens
	background: "#ffffff",
	foreground: "#000000",
	card: "#202020",
	cardForeground: "#d9d9d9",
	primary: "#ffffff",
	primaryForeground: "#1a1a1a",
	secondary: "#303030",
	secondaryForeground: "#d9d9d9",
	muted: "#2a2a2a",
	mutedForeground: "#808080",
	accent: "#242424",
	accentForeground: "#d9d9d9",
	destructive: "#e06666",
	border: "#353535",
	input: "#303030",
	ring: "#a0a0a0",

	// Brand colors (:root)
	brandBlue: "#1f40ed",
	brandOrange: "#e62200",
	brandOrangeOverlay: "#ff3714",
	brandGray: "#151515",
} as const;
