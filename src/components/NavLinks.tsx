'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ADMIN_IDS } from '@/lib/auth';

const baseLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/franchises', label: 'Franchises' },
  { href: '/trade-center', label: 'Trade Center' },
  { href: '/auction', label: 'Auction' },
  { href: '/auction-summary', label: 'Summary' },
];

export function NavLinks() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);
  
  const links = isAdmin 
    ? [...baseLinks, { href: '/admin', label: 'Admin' }]
    : baseLinks;

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-gray-400 hover:text-white hover:bg-surface'
              } ${link.href === '/admin' ? 'text-accent' : ''}`}
            >
              {link.label}
              {link.href === '/admin' && (
                <span className="ml-1 text-xs">🔒</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface transition-colors"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-surface border-b border-border md:hidden z-50">
          <nav className="flex flex-col p-4 space-y-2">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-gray-400 hover:text-white hover:bg-surface-light'
                  } ${link.href === '/admin' ? 'text-accent' : ''}`}
                >
                  {link.label}
                  {link.href === '/admin' && (
                    <span className="ml-1 text-xs">🔒</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
