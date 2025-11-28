/**
 * Main export combining workspace and organization reserved names
 */

import workspace from './workspace.js';
import organization from './organization.js';

export default {
  workspace,
  organization,
} as const;
