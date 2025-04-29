import { execSync } from "child_process";
import { join } from "path";

import { env } from "../env/node-env";

try {
  // Generate types using Supabase CLI
  const outputPath = join("src", "types", "supabase.types.ts");
  execSync(
    `npx supabase gen types typescript --project-id "${env.SUPABASE_PROJECT_ID}" --schema public > ${outputPath}`,
    { stdio: "inherit" },
  );
  console.log("✅ Successfully generated Supabase types");
} catch (error) {
  if (error instanceof Error) {
    console.error("❌ Error generating Supabase types:", error.message);
  } else {
    console.error("❌ Error generating Supabase types:", error);
  }
  process.exit(1);
}
