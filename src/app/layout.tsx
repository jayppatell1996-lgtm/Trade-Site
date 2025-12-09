import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutGrid, ArrowLeftRight, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Wispbyte League',
  description: 'Fantasy cricket league management',
};

function NavLink({ href, children, icon: Icon }: { href: string; children: React.ReactNode; icon: any }) {
  return (
    <Link 
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon size={18} />
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div className="container" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
          }}>
            <Link href="/" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: 700,
              fontSize: '18px',
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--accent-green)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '14px',
              }}>
                W
              </div>
              WISPBYTE LEAGUE
            </Link>
            
            <nav style={{ display: 'flex', gap: '8px' }}>
              <NavLink href="/" icon={LayoutGrid}>Dashboard</NavLink>
              <NavLink href="/trade-center" icon={ArrowLeftRight}>Trade Center</NavLink>
              <NavLink href="/franchises" icon={Users}>Franchises</NavLink>
            </nav>
          </div>
        </header>
        
        <main style={{ minHeight: 'calc(100vh - 64px)', paddingBottom: '40px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
