import type { Metadata } from "next";
import { PitchDeck } from "./_components/pitch-deck";

export const metadata: Metadata = {
  title: "Pitch Deck | Lightfast",
  description: "Lightfast surfaces every decision your team makes across your tools",
  openGraph: {
    title: "Pitch Deck | Lightfast",
    description: "Lightfast surfaces every decision your team makes across your tools",
    type: "website",
  },
};

export default function PitchDeckPage() {
  return (
    <div className="min-h-screen bg-background">
      <PitchDeck />
    </div>
  );
}
