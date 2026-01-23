import type { Metadata } from "next";
import { PitchDeck } from "~/components/pitch-deck";
import { PitchDeckNavbar } from "~/components/pitch-deck-navbar";

export const metadata: Metadata = {
  title: "Pitch Deck | Lightfast",
  description: "Lightfast - The memory layer for software teams",
  openGraph: {
    title: "Pitch Deck | Lightfast",
    description: "Lightfast - The memory layer for software teams",
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
