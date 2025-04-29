import type { LinkProps } from "next/link";
import Link from "next/link";

import type { NavItemRecord } from "@repo/ui/types/nav";

export const SimpleDotFooter = ({ nav }: { nav: NavItemRecord<string> }) => {
  return (
    <footer className="from-background/80 fixed right-0 bottom-0 left-0 flex justify-center bg-gradient-to-t to-transparent pt-2 pb-4 backdrop-blur-sm">
      <nav className="text-muted-foreground flex items-center gap-4 text-sm">
        {Object.values(nav).map((item) => (
          <div key={item.title} className="flex items-center gap-4">
            <FooterLink href={item.href}>{item.title}</FooterLink>
            <FooterDot />
          </div>
        ))}
      </nav>
    </footer>
  );
};

const FooterDot = () => <span className="text-muted-foreground/40">•</span>;

interface FooterLinkProps extends LinkProps {
  children: React.ReactNode;
}

const FooterLink: React.FC<FooterLinkProps> = ({
  href,
  children,
  ...props
}) => {
  return (
    <Link href={href} {...props} target="_blank">
      <span className="hover:text-foreground inline-block transition-all duration-200 hover:-translate-y-[1px]">
        {children}
      </span>
    </Link>
  );
};
