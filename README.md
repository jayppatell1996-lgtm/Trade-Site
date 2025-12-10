# Wispbyte League v2

Fantasy Cricket League Management Platform with Live Auction System

## Features

### 🏟️ Franchises
- View all teams with remaining purse values
- Roster management
- Player tracking with purchase prices

### 🔄 Trade Center
- Execute trades between teams
- Only team owners can trade their players
- Full trade history tracking

### 🔨 Live Auction System
- Real-time bidding with timer
- 6 auction rounds support
- Bid increment tiers (matching Discord bot logic):
  - Base ≥ $2M → $1M increment
  - Base ≥ $1M → $500K increment
  - Base ≥ $500K → $250K increment
  - Else → base price increment
- Timer: 10s initial, 6s on subsequent bids
- Admin controls: Start, Next, Sold, Pause/Resume, Stop

### 🔐 Admin Panel (PS & CT Owners Only)
Access restricted to Discord IDs:
- `256972361918578688` (CT Owner)
- `1111497896018313268` (PS Owner)

Admin features:
- Edit teams (name, owner, purse, max size)
- Manage players (add/remove)
- Import teams from JSON
- Import auction rounds from JSON
- Import unsold players from JSON

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Discord OAuth
DISCORD_CLIENT_ID=1308127862485684268
DISCORD_CLIENT_SECRET=your-secret

# NextAuth
NEXTAUTH_URL=https://trade-site-teal.vercel.app
NEXTAUTH_SECRET=your-secret-key
```

### 2. Discord OAuth Setup

Add this redirect URL in Discord Developer Portal:
```
https://trade-site-teal.vercel.app/api/auth/callback/discord
```

### 3. Database Setup

Push the schema to your database:
```bash
npm run db:push
```

Or generate migrations:
```bash
npm run db:generate
npm run db:migrate
```

### 4. Seed Data (Optional)

To seed with initial data:
```bash
npx tsx scripts/seed.ts
```

### 5. Development

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

Add these environment variables in Vercel:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

## JSON Import Formats

### Teams Format
```json
{
  "teams": {
    "TeamName": {
      "owner": "discord_id",
      "max_size": 20,
      "purse": 50000000,
      "players": ["Player 1", "Player 2"]
    }
  }
}
```

### Auction Round Format
```json
{
  "players_for_auction": [
    {
      "name": "Player Name",
      "category": "Batsman",
      "base_price": 500000
    }
  ]
}
```

### Unsold Players Format
```json
{
  "unsold": [
    {
      "name": "Player Name",
      "category": "Bowler",
      "base_price": 100000
    }
  ]
}
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Turso (SQLite)
- **ORM**: Drizzle
- **Auth**: NextAuth.js with Discord
- **Styling**: Tailwind CSS
- **Hosting**: Vercel

## Database Schema

- `teams` - Franchise information
- `players` - Players on team rosters
- `trades` - Trade history
- `auction_rounds` - 6 auction rounds
- `auction_players` - Players in each round
- `auction_state` - Current auction state
- `auction_logs` - Auction activity logs
- `unsold_players` - Unsold player pool
