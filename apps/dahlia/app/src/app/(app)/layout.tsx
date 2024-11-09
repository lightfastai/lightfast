import { SiteFooter } from "~/components/site-footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
