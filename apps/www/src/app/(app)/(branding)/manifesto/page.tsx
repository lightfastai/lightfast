import { ManifestoPresentation } from "~/components/landing/manifesto-presentation";

export default function ManifestoPage() {
  return (
    <div className="relative manifesto-page bg-background h-screen overflow-hidden">
      {/* Manifesto Presentation - Full viewport */}
      <ManifestoPresentation />
    </div>
  );
}
