import TitleBar from "./title-bar";

interface ComposerRootLayoutProps {
  children: React.ReactNode;
}

export function ComposerRootLayout({ children }: ComposerRootLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col">
      <TitleBar />
      {children}
    </div>
  );
}
