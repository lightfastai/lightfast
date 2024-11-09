import Link from "next/link";

export const SiteFooter = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-background/80 to-transparent pb-4 pt-2 backdrop-blur-sm">
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        <FooterLink href="https://dahlia.art/docs">Docs</FooterLink>
        <FooterDot />
        <FooterLink
          href="https://github.com/jeevanpillaystudio"
          target="_blank"
        >
          GitHub
        </FooterLink>
        <FooterDot />
        <FooterLink href="https://dahlia.art/legal/terms">Terms</FooterLink>
        <FooterDot />
        <FooterLink href="https://dahlia.art/legal/privacy">Privacy</FooterLink>
      </nav>
    </footer>
  );
};

const FooterDot = () => <span className="text-muted-foreground/40">•</span>;

const FooterLink = ({
  href,
  children,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  [key: string]: any;
}) => {
  return (
    <Link href={href} {...props}>
      <span className="inline-block transition-all duration-200 hover:-translate-y-[1px] hover:text-foreground">
        {children}
      </span>
    </Link>
  );
};
