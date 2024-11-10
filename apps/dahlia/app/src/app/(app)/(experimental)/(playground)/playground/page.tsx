import { AppLayout } from "@repo/ui/components/app-layout";

import { TextureSelectorCombobox } from "./components/texture-selector-combobox";

export default function TexturePage() {
  return (
    <AppLayout>
      <header className="flex items-center justify-between">
        <h1 className="font-mono text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          Texture: <TextureSelectorCombobox />
        </h1>
      </header>

      <div className="flex h-full w-full border">hi</div>
    </AppLayout>
  );
}
