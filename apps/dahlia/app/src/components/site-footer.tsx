import Link, { LinkProps } from "next/link";
import { siteNav } from "~/config/site";

export const SiteFooter = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-background/80 to-transparent pb-4 pt-2 backdrop-blur-sm">
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        {siteNav.footerNav.map((item) => (
          <>
            <FooterLink href={item.href ?? "/"}>{item.title}</FooterLink> {/** TODO: fix this ?? "/"*/}
            <FooterDot />
          </>
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
      <span className="inline-block transition-all duration-200 hover:-translate-y-[1px] hover:text-foreground">
        {children}
      </span>
    </Link>
  );
};
