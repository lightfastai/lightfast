import { Unkey } from "@unkey/api";
import { unkeyEnv } from "../env";

export const unkey = new Unkey({ rootKey: unkeyEnv.UNKEY_ROOT_KEY });

export const UNKEY_API_ID = unkeyEnv.UNKEY_API_ID;

export { Unkey } from "@unkey/api";
