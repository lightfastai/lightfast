import "server-only";

import {
  createPlatformClient,
  type ServiceCaller,
} from "@repo/platform-client";

import { platformUrl } from "../origins";

export function platformAs(caller: ServiceCaller) {
  return createPlatformClient({ caller, baseUrl: platformUrl });
}
