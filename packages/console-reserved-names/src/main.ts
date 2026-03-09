/**
 * Main export combining workspace and organization reserved names
 */

import organization from "./organization.js";
import workspace from "./workspace.js";

export default {
  workspace,
  organization,
} as const;
