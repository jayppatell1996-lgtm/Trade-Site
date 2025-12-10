import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Trade Site - Cricket League',
  description: 'Manage your cricket league teams, trades, and auctions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        {/* Navigation */}
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <span className="text-2xl">🏏</span>
                <span className="font-bold text-xl">League Hub</span>
              </Link>

              {/* Nav Links */}
              <div className="flex items-center gap-6">
                <Link 
                  href="/" 
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link 
                  href="/franchises" 
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Franchises
                </Link>
                <Link 
                  href="/trades" 
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Trades
                </Link>
                <Link 
                  href="/auction" 
                  className="text-gray-300 hover:text-white transition-colors px-3 py-1 bg-red-600/20 border border-red-600/50 rounded-lg"
                >
                  🔴 Auction
                </Link>
                <Link 
                  href="/admin" 
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  🔐 Admin
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main>{children}</main>
      </body>
    </html>
  );
}
