import type { ReactNode } from "react";
import { Cta } from "./_components/cta";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Cta />
      <Footer />
    </>
  );
}
