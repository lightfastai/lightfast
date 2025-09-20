import type { Config } from "tailwindcss";
// @ts-expect-error - no types in preset
import nativewind from "nativewind/preset";

const config = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [nativewind],
  theme: {
    extend: {
      colors: {
        background: "oklch(0.2178 0 0)",
        foreground: "oklch(0.8853 0 0)",
        card: {
          DEFAULT: "oklch(0.2435 0 0)",
          foreground: "oklch(0.8853 0 0)",
        },
        popover: {
          DEFAULT: "oklch(0.2178 0 0)",
          foreground: "oklch(0.8853 0 0)",
        },
        primary: {
          DEFAULT: "oklch(0.7058 0 0)",
          foreground: "oklch(0.2178 0 0)",
        },
        secondary: {
          DEFAULT: "oklch(0.3092 0 0)",
          foreground: "oklch(0.8853 0 0)",
        },
        muted: {
          DEFAULT: "oklch(0.285 0 0)",
          foreground: "oklch(0.5999 0 0)",
        },
        accent: {
          DEFAULT: "oklch(0.26 0 0)",
          foreground: "oklch(0.8853 0 0)",
        },
        destructive: {
          DEFAULT: "oklch(0.6591 0.153 22.1703)",
          foreground: "oklch(1 0 0)",
        },
        border: "oklch(0.329 0 0)",
        input: "oklch(0.3092 0 0)",
        "input-bg": "oklch(0.24 0 0)",
        ring: "oklch(0.7058 0 0)",
        "chart-1": "oklch(0.7058 0 0)",
        "chart-2": "oklch(0.6714 0.0339 206.3482)",
        "chart-3": "oklch(0.5452 0 0)",
        "chart-4": "oklch(0.4604 0 0)",
        "chart-5": "oklch(0.3715 0 0)",
        sidebar: {
          DEFAULT: "oklch(0.2178 0 0)",
          foreground: "oklch(0.8853 0 0)",
          primary: "oklch(0.7058 0 0)",
          "primary-foreground": "oklch(0.2178 0 0)",
          accent: "oklch(0.26 0 0)",
          "accent-foreground": "oklch(0.8853 0 0)",
          border: "oklch(0.329 0 0)",
          ring: "oklch(0.7058 0 0)",
        },
        "user-message-bg": "oklch(0.2 0 0)",
      },
    },
  },
} satisfies Config;

export default config;
