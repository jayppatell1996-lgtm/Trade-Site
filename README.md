# The League

A fantasy cricket league management webapp with trading, analytics, and roster management.

![Dashboard](https://trade-site-teal.vercel.app/)

## Features

- 🔐 **Discord Authentication** - Sign in with Discord to verify team ownership
- 📊 **Dashboard** - Real-time league stats and recent trades
- 🔄 **Trade Center** - Only accessible to team owners
- 👥 **Franchises** - View all team rosters

## Setup Guide

### 1. Turso Database (you already have this)

Your existing credentials:
```
TURSO_DATABASE_URL=libsql://league-trading-theogmaniac.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=your-existing-token
```

### 2. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** → name it "Wispbyte League"
3. Go to **OAuth2** in the sidebar
4. Copy the **Client ID** and **Client Secret**
5. Add redirect URLs:
   - For local: `http://localhost:3000/api/auth/callback/discord`
   - For Vercel: `https://your-app.vercel.app/api/auth/callback/discord`

### 3. Update Environment Variables

Create/update your `.env` file:

```env
# Turso (existing)
TURSO_DATABASE_URL=libsql://league-trading-theogmaniac.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=your-existing-token

# Discord OAuth (new)
DISCORD_CLIENT_ID=your-client-id-from-discord
DISCORD_CLIENT_SECRET=your-client-secret-from-discord

# NextAuth (new)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any-random-string-at-least-32-chars
```

Generate a random secret:
```bash
openssl rand -base64 32
```

### 4. Install & Run

```bash
npm install
npm run dev
```

### 5. Deploy to Vercel

Add these environment variables in Vercel:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXTAUTH_URL` = `https://your-app.vercel.app`
- `NEXTAUTH_SECRET`

**Important:** Update your Discord app's OAuth2 redirect URL to include your Vercel URL.

---

## How Authentication Works

1. Users sign in with Discord
2. The app gets their Discord User ID
3. This ID is matched against `ownerId` in the teams table
4. Only matching team owners can trade those teams' players

### Team Ownership

Your teams have Discord User IDs as owners. For example:
- **RR** owned by `581514869879078931`
- **CT** owned by `256972361918578688`

The owner's Discord account must match these IDs to trade.

### Updating Team Ownership

To change who owns a team:

```sql
-- In Turso dashboard or Drizzle Studio
UPDATE teams SET owner_id = 'new-discord-user-id' WHERE name = 'RR';
```

To find a Discord User ID:
1. Enable Developer Mode in Discord (Settings → Advanced)
2. Right-click on a user → Copy User ID

---

## File Changes from Original

New files added for authentication:
```
src/
├── lib/auth.ts              # NextAuth config
├── components/
│   ├── AuthProvider.tsx     # Session wrapper
│   └── UserNav.tsx          # Login/logout UI
├── app/
│   ├── login/page.tsx       # Login page
│   └── api/auth/[...nextauth]/route.ts
```

Modified files:
- `src/app/layout.tsx` - Added AuthProvider and UserNav
- `src/app/trade-center/page.tsx` - Auth checks + owner validation
- `src/app/api/trades/route.ts` - Server-side owner validation
