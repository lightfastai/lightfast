import type { PluginAPI } from "tailwindcss/types/config";
import plugin from "tailwindcss/plugin";

// @important as of 17th November 2024, i've done small testing and seems like this is not needed for `no-scrollbar` to work
// eslint-disable-next-line
export const noScrollbar = plugin(({ addUtilities }: PluginAPI) => {
  /** Little hack for components that do not want to show the scrollbar. Usage: `no-scrollbar` in a components className */
  addUtilities({
    ".no-scrollbar": {
      scrollbarWidth: "none",
      "-ms-overflow-style": "none",
    },
    ".no-scrollbar::-webkit-scrollbar": {
      display: "none",
    },
  });
});
