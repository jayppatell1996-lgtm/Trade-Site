import { AuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

// Admin Discord IDs (PS and CT owners)
export const ADMIN_IDS = ['256972361918578688'];

// Extend the built-in types
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordId?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.discordId = (profile as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.discordId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

// Helper function to check if user is admin
export function isAdmin(discordId?: string): boolean {
  return discordId ? ADMIN_IDS.includes(discordId) : false;
}
