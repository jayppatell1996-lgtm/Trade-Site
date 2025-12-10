import { AuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

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
      // Store the Discord user ID in the token
      if (account && profile) {
        // Discord profile has 'id' field
        token.discordId = (profile as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      // Make Discord ID available in the session
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
