# The League

A fantasy cricket league management webapp with trading, analytics, and roster management.

![Dashboard](https://via.placeholder.com/800x400?text=League+Dashboard)

## Features

- 📊 **Dashboard** - Real-time league statistics, recent trades, and franchise status
- 🔄 **Trade Center** - Propose and execute player trades between teams
- 👥 **Franchises** - View all team rosters with search functionality
- ✏️ **Easy Data Editing** - Use Turso's Drizzle Studio to edit data visually

## Tech Stack

- **Frontend**: Next.js 15 (React 19)
- **Database**: Turso (SQLite on the edge)
- **ORM**: Drizzle ORM
- **Hosting**: Vercel (free tier)
- **Total Cost**: $0/year

---

## Setup Guide

### Step 1: Create a Turso Database (Free)

1. Go to [turso.tech](https://turso.tech) and sign up (free)
2. Create a new database:
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # Login
   turso auth login
   
   # Create database
   turso db create wispbyte-league
   
   # Get your database URL
   turso db show wispbyte-league --url
   
   # Create an auth token
   turso db tokens create wispbyte-league
   ```
3. Save the URL and token - you'll need these!

### Step 2: Clone and Configure

```bash
# Clone the repo
git clone https://github.com/your-username/wispbyte-league.git
cd wispbyte-league

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
```

Edit `.env.local` with your Turso credentials:
```
TURSO_DATABASE_URL=libsql://wispbyte-league-your-username.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

### Step 3: Initialize the Database

```bash
# Push the schema to Turso
npm run db:push

# Seed with your existing data
npm run db:seed
```

### Step 4: Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Step 5: Deploy to Vercel (Free)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign up
3. Click "New Project" and import your repo
4. Add environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
5. Deploy!

---

## Editing Data Manually

### Option 1: Drizzle Studio (Visual Editor)

```bash
npm run db:studio
```

This opens a visual spreadsheet-like interface at `https://local.drizzle.studio` where you can:
- View and edit teams
- Add/remove players
- Modify trade history

### Option 2: Turso Dashboard

1. Go to [turso.tech](https://turso.tech)
2. Select your database
3. Click "Shell" to run SQL queries

Example queries:
```sql
-- Add a new player
INSERT INTO players (player_id, name, team_id) 
VALUES ('newp1234', 'New Player Name', 1);

-- Move a player to another team
UPDATE players SET team_id = 2 WHERE player_id = 'newp1234';

-- Delete a player
DELETE FROM players WHERE player_id = 'newp1234';

-- View all teams
SELECT * FROM teams;
```

### Option 3: CLI

```bash
turso db shell wispbyte-league
```

---

## Trade Rules

Based on the original Discord bot logic:

1. Both teams must offer at least 1 player
2. Maximum 5 players per side in a trade
3. Teams cannot exceed their max roster size (20)
4. Same player cannot be on both sides of a trade
5. All trades are recorded in history

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Dashboard
│   ├── trade-center/      # Trade Center page
│   ├── franchises/        # Franchises page
│   ├── api/               # API routes
│   │   ├── teams/
│   │   ├── trades/
│   │   └── stats/
│   ├── layout.tsx         # Root layout with nav
│   └── globals.css        # Styling
├── components/            # Reusable components
├── db/
│   ├── schema.ts          # Database schema
│   ├── index.ts           # DB connection
│   └── seed.ts            # Seed script
└── lib/
    └── queries.ts         # Data queries
```

---

## Customization

### Adding New Teams

```sql
INSERT INTO teams (name, owner_id, max_size) 
VALUES ('NEW', 'discord_user_id', 20);
```

### Changing Team Size Limits

```sql
UPDATE teams SET max_size = 25 WHERE name = 'RR';
```

### Clearing All Trades

```sql
DELETE FROM trades;
```

---

## License

MIT - Use this however you'd like for your private league!
