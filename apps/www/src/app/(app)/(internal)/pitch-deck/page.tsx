import type { Metadata } from "next";
import { PitchDeck } from "./_components/pitch-deck";

export const metadata: Metadata = {
  title: "Pitch Deck | Lightfast",
  description: "Lightfast — the operating layer between your agents and apps",
  openGraph: {
    title: "Pitch Deck | Lightfast",
    description: "Lightfast — the operating layer between your agents and apps",
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
