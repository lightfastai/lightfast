import baseConfig from "@repo/eslint-config/base";
import reactCompiler from "eslint-plugin-react-compiler";

export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  {
    plugins: {
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-compiler/react-compiler": "error",
    },
  },
];
