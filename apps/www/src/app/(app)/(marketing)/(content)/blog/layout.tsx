export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Main content */}
      <main>{children}</main>

      {/* Newsletter signup - shown on all blog pages
      <div className="max-w-7xl mx-auto px-4">
        <NewsletterSignup />
      </div>
      */}
    </div>
  );
}

