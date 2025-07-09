import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Next.js 15 App',
  description: 'Created with Next.js 15, TypeScript, and Tailwind CSS v4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark antialiased`}>
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
