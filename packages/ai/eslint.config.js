import baseConfig from "@repo/eslint-config/base";
import { evalConfig } from "@repo/eslint/base";
/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  ...evalConfig,
];
