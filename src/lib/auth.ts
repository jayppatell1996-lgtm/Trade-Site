import { AuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

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
        token.discordId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Make Discord ID available in the session
      if (session.user) {
        (session.user as any).discordId = token.discordId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
