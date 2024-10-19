import plugin from "tailwindcss/plugin";

export default plugin(function ({ addUtilities }) {
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
