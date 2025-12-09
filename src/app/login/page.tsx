'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="container" style={{ 
      paddingTop: '100px', 
      maxWidth: '400px',
      textAlign: 'center',
    }}>
      <div className="card" style={{ padding: '48px 32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--accent-green)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          fontSize: '24px',
          color: 'var(--bg-primary)',
        }}>
          W
        </div>
        
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 700, 
          marginBottom: '8px',
        }}>
          Welcome Back
        </h1>
        
        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          Sign in with your Discord account to manage your team and make trades.
        </p>
        
        <button
          onClick={() => signIn('discord', { callbackUrl: '/' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '14px 24px',
            background: '#5865F2',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 71 55" fill="none">
            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3## 44.2785 53.4831 44.2898 53.55 44.3433C53.9054 44.6363 54.2776 44.9293 54.6526 45.2082C54.7813 45.304 54.7## 45.5041 54.6303 45.5858C52.8616 46.6197 51.0229 47.4931 49.0891 48.2228C48.9632 48.2707 48.9072 48.4172 48.9688 48.5383C50.0380 50.6034 51.2554 52.5699 52.5765 54.4350C52.6325 54.5139 52.7332 54.5765 52.8256 54.5195C58.6268 52.7249 64.5095 50.0174 70.5824 45.5576C70.6356 45.5182 70.6692 45.459 70.6748 45.3942C72.1688 29.9 68.1560 16.5999 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" fill="white"/>
          </svg>
          Continue with Discord
        </button>
      </div>
    </div>
  );
}
