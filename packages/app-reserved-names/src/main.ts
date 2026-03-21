/**
 * Main export combining workspace and organization reserved names
 */

import organization from "./organization";
import workspace from "./workspace";

export default {
  workspace,
  organization,
} as const;
