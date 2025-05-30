interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* <SiteHeader /> */}
      <div className="relative flex-1">
        <main className="h-full">{children}</main>
      </div>
      {/* <OpenSourceMcpSection /> */}
      {/* <IntegrationsSection /> */}
      {/* <SiteFooter /> */}
    </div>
  );
}
