import { HydrateClient } from "~/trpc/server";
import { GeometryAIGenerator } from "../components/geometry-ai-gen";

export const runtime = "edge";

export default function HomePage() {
  return (
    <HydrateClient>
      <GeometryAIGenerator />
    </HydrateClient>
  );
}
