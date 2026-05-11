import type React from "react";

export default function ClientHandshakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
