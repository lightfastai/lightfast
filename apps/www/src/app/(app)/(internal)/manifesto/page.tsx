import { ManifestoShader } from "./_components/manifesto-shader";

export default function ManifestoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="relative aspect-[4/3] w-full max-w-2xl">
        <ManifestoShader />
      </div>
    </main>
  );
}
