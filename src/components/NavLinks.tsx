'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  
  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);
  
  const links = isAdmin 
    ? [...baseLinks, { href: '/admin', label: 'Admin' }]
    : baseLinks;

  return (
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
  );
}
