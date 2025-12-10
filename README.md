# Trade Site Upgrade v2.0

A comprehensive cricket league management webapp with live auction system, team management, and trading functionality.

## 🚀 New Features

### 1. **Purse Display on Franchises**
- Each team now shows remaining purse prominently
- Roster capacity bars with color coding
- Expandable player lists with purchase prices

### 2. **Full Auction System**
Matches the Discord bot functionality exactly:
- **Admin Controls**: Start, Next, Sold, Pause/Resume, Stop
- **Live Bidding**: Any team owner can bid
- **Timer System**: 10 seconds initial, 6 seconds after each bid
- **Bid Increments**: 
  - $2M+ base → $1M increments
  - $1M+ base → $500K increments
  - $500K+ base → $250K increments
  - Below $500K → increment = base price
- **Authorization**: Only Discord IDs `256972361918578688` (CT) and `1111497896018313268` (PS) can control the auction

### 3. **Round Selection**
- 6 auction rounds (+ 1 unsold pool)
- Select which round to auction from
- Track progress per round

### 4. **Admin Panel**
- **Teams Tab**: Edit team owner, purse, max size
- **Rounds Tab**: View round status, clear players
- **Import Tab**: Import teams/players from JSON files
- **Admins Tab**: Manage authorized admins

## 📦 Database Tables

| Table | Purpose |
|-------|---------|
| `teams` | Team info with purse |
| `players` | Players assigned to teams |
| `trades` | Trade history |
| `auction_rounds` | 6 rounds + unsold pool |
| `auction_players` | Players for auction in each round |
| `auction_state` | Current live auction state |
| `auction_logs` | Auction activity logs |
| `auction_history` | Sale history |
| `authorized_admins` | Who can control auction |

## 🔧 Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd trade-site-upgrade
npm install
```

### 2. Configure Turso Database

Create a database at [turso.tech](https://turso.tech):

1. Sign up/login
2. Create database: `trade-site`
3. Get your database URL and auth token

Create `.env.local`:
```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

### 3. Initialize Database

```bash
# Push schema to Turso
npm run db:push

# Seed with initial data (teams, rounds, admins)
npm run db:seed
```

### 4. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy to Vercel

1. Push code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy!

## 📁 Importing Data from Discord Bot

### Import Teams (from auction_data.json)

In the Admin Panel → Import tab:
1. Select "Teams (from auction_data.json)"
2. Paste your JSON:
```json
{
  "teams": {
    "SKR": {
      "owner": "1127099249226690652",
      "purse": 50000000,
      "max_size": 20,
      "players": ["Ben Stokes", "Virat Kohli"]
    }
  }
}
```

### Import Auction Players (from Round_1.json, etc.)

1. Select "Auction Players (Round_1.json etc.)"
2. Select the target round
3. Paste your JSON:
```json
{
  "players_for_auction": [
    { "name": "KL Rahul", "category": "Batsman", "base_price": 2000000 },
    { "name": "Fakhar Zaman", "category": "Batsman", "base_price": 2000000 }
  ]
}
```

## 🔐 Authorization

### Hardcoded Admins (cannot be removed)
- `256972361918578688` - CT Owner
- `1111497896018313268` - PS Owner

### Adding More Admins
Use the Admin Panel → Admins tab to add additional Discord IDs.

## 📱 Pages

| Page | URL | Access |
|------|-----|--------|
| Dashboard | `/` | Public |
| Franchises | `/franchises` | Public |
| Trade Center | `/trades` | Team Owners |
| Live Auction | `/auction` | Public (bid = owners only) |
| Admin Panel | `/admin` | Admins only |

## 🎯 Auction Flow

1. **Admin** goes to `/auction` and logs in with Discord ID
2. **Admin** selects a round from dropdown
3. **Admin** clicks **Start** → First player begins auction
4. **Team Owners** click **Bid** to place bids
5. Timer counts down (resets on each bid)
6. **Admin** clicks **Sold** to finalize, or **Next** to skip
7. Player is added to winning team, purse is deducted
8. Repeat until round complete

## 📊 Database Commands

```bash
# Push schema changes
npm run db:push

# Open visual database editor
npm run db:studio

# Re-seed database
npm run db:seed
```

## 🔄 Migrating from Discord Bot

1. Export your `auction_data.json` from the bot
2. Use Admin Panel → Import to load teams
3. Export each `Round_X.json` file
4. Import players to respective rounds
5. Your data is now in the webapp!

---

Built with Next.js, Turso (SQLite), and Tailwind CSS.
