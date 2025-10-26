// import { ManifestoPresentation } from "~/components/landing/manifesto-presentation";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";

export default function ManifestoPage() {
  return (
    <div className="relative manifesto-page bg-background h-screen overflow-hidden">
      {/* Manifesto Grid - Full viewport */}
      <div className="h-full py-32 px-16 manifesto">
        <div className="h-full rounded-sm overflow-hidden">
          <ManifestoGrid />
        </div>
      </div>
      {/* Manifesto Presentation - Commented out for now */}
      {/* <ManifestoPresentation /> */}
    </div>
  );
}
