import { MainNav } from "./main-nav";

export const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full py-6 backdrop-blur">
      <div className="container flex items-center">
        <MainNav />
        {/* <MobileNav /> */}
      </div>
    </header>
  );
};
