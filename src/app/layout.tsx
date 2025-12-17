import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import UserNav from '@/components/UserNav';
import Link from 'next/link';
import { NavLinks } from '@/components/NavLinks';

export const metadata: Metadata = {
  title: 'Wispbyte League',
  description: 'Fantasy Cricket League Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>
          <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-50 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-4 md:gap-8">
                  <Link href="/" className="flex items-center gap-2">
                    <span className="text-accent text-2xl">⚡</span>
                    <span className="font-bold text-lg tracking-tight">THE LEAGUE</span>
                  </Link>
                  <NavLinks />
                </div>
                <UserNav />
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
