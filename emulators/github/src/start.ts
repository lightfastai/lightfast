import { runStart } from "@repo/emulator-kit";

import { githubManifest } from "./manifest";

await runStart(githubManifest);
