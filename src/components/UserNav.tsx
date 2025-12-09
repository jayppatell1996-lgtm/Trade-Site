'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, User } from 'lucide-react';

export default function UserNav() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        padding: '8px 16px',
        color: 'var(--text-muted)',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  if (session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          {session.user?.image ? (
            <img 
              src={session.user.image} 
              alt="Avatar"
              style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%',
              }}
            />
          ) : (
            <User size={18} style={{ color: 'var(--text-muted)' }} />
          )}
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {session.user?.name}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('discord')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: '#5865F2',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <LogIn size={18} />
      Sign in with Discord
    </button>
  );
}
