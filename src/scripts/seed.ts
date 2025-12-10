import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { 
  teams, 
  players, 
  auctionRounds, 
  auctionPlayers, 
  auctionState,
  authorizedAdmins 
} from '../db/schema';
import { eq } from 'drizzle-orm';

// Environment variables are loaded by Next.js or need to be set in shell
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

// ==========================================
// TEAM DATA FROM auction_data.json
// ==========================================
const teamsData: Record<string, { owner: number | string; max_size: number; purse: number; players: string[] }> = {
  "SKR": {
    "owner": 1127099249226690652,
    "max_size": 20,
    "purse": 50000000,
    "players": ["Ben Stokes", "Quinton de Kock", "Rashid Khan", "Josh Hazlewood", "Mitchell Santner", "Mitch Marsh", "Shreyas Iyer", "Virat Kohli"]
  },
  "CT": {
    "owner": 256972361918578688,
    "max_size": 20,
    "purse": 47250000,
    "players": ["Steve Smith", "Matt Henry", "Sanju Samson", "Glenn Maxwell", "Mohammed Shami", "Salman Ali Agha", "Shakib Al Hasan", "Saud Shakeel", "Jonny Bairstow", "Tristan Stubbs", "Ruturaj Gaikwad", "Kyle Mayers", "Johnson Charles"]
  },
  "RR": {
    "owner": 581514869879078931,
    "max_size": 20,
    "purse": 50000000,
    "players": ["Jasprit Bumrah", "Rohit Sharma", "Ishan Kishan", "Rishab Pant", "Axar Patel", "Washington Sundar", "Marcus Stoinis", "Cameron Green", "Beau Webster"]
  },
  "PS": {
    "owner": 1111497896018313268,
    "max_size": 20,
    "purse": 52000000,
    "players": ["Shubman Gill", "Kagiso Rabada", "Phil Salt", "Nicholas Pooran", "Hardik Pandya", "Glenn Phillips", "Adam Zampa", "Abhishek Sharma", "Surya Kumar Yadav", "Dhruv Jurel"]
  },
  "CC": {
    "owner": 447509310679810054,
    "max_size": 20,
    "purse": 50000000,
    "players": ["Moeen Ali", "Liam Livingstone", "Andre Russell", "Harry Brook", "Joe Root", "Luke Wood", "Adil Rashid", "Ben Duckett", "Imam-ul-Haq"]
  },
  "BABT": {
    "owner": 585802481779474466,
    "max_size": 20,
    "purse": 50000000,
    "players": ["Kane Williamson", "Yashasvi Jaiswal", "Daryl Mitchell", "KL Rahul", "Ravindra Jadeja", "Kuldeep Yadav", "Alex Hales", "Matheesha Pathirana"]
  },
  "KKK": {
    "owner": 485543064266604581,
    "max_size": 20,
    "purse": 50000000,
    "players": ["Babar Azam", "Shan Masood", "Mitchell Starc", "Sikandar Raza", "Moises Henriques", "David Miller", "Rassie van der Dussen", "Devon Conway", "Johnson Charles"]
  },
  "HH": {
    "owner": 432404829374119948,
    "max_size": 20,
    "purse": 46000000,
    "players": ["Jos Butler", "Heinrich Klassen", "Shaheen Shah Afridi", "Will Jacks", "Abrar Ahmed", "Aiden Markram", "Travis Head", "Pat Cummins", "Jake Fraser-McGurk", "Labuschagne"]
  },
  "MM": {
    "owner": 1332483496186220564,
    "max_size": 20,
    "purse": 25500000,
    "players": ["Mohammad Rizwan", "Jason Roy", "Michael Bracewell", "Tim David", "Romario Shepherd", "Mark Wood", "Shamar Joseph", "Ravi Bishnoi", "Dewald Brevis", "Will Young", "Surya Kumar Yadav", "Usman Khawaja", "Jake Fraser-McGurk", "Imam-ul-Haq"]
  },
  "PP": {
    "owner": 736276210719391764,
    "max_size": 20,
    "purse": 72000000,
    "players": ["Marco Jansen", "Naseem Shah", "James Neesham", "Colin Munro", "Rinku Singh", "Sunil Narine", "Rilee Rossouw", "Finn Allen", "Tom Latham", "Matt Short"]
  }
};

// ==========================================
// ROUND 1 PLAYERS
// ==========================================
const round1Players = [
  { name: "KL Rahul", category: "Batsman", base_price: 2000000 },
  { name: "Marnus Labuschagne", category: "Batsman", base_price: 2000000 },
  { name: "Fakhar Zaman", category: "Batsman", base_price: 2000000 },
  { name: "Ben Duckett", category: "Batsman", base_price: 2000000 },
  { name: "Jason Roy", category: "Batsman", base_price: 2000000 },
  { name: "Rahmanullah Gurbaz", category: "Batsman", base_price: 1000000 },
  { name: "Tim David", category: "Batsman", base_price: 1000000 },
  { name: "Marcus Harris", category: "Batsman", base_price: 1000000 },
  { name: "Josh Inglis", category: "Batsman", base_price: 1000000 },
  { name: "Tom Latham", category: "Batsman", base_price: 1000000 },
  { name: "Shaun Marsh", category: "Batsman", base_price: 1000000 },
  { name: "Tim Seifert", category: "Batsman", base_price: 1000000 },
  { name: "Usman Khawaja", category: "Batsman", base_price: 1000000 },
  { name: "Rassie van der Dussen", category: "Batsman", base_price: 1000000 },
  { name: "Shikhar Dhawan", category: "Batsman", base_price: 1000000 },
  { name: "Saim Ayub", category: "Batsman", base_price: 1000000 },
  { name: "Alex Carey", category: "Batsman", base_price: 1000000 },
  { name: "Shai Hope", category: "Batsman", base_price: 1000000 },
  { name: "Jake Fraser-McGurk", category: "Batsman", base_price: 500000 },
  { name: "Azhar Ali", category: "Batsman", base_price: 500000 },
  { name: "Mohammad Haris", category: "Batsman", base_price: 500000 },
  { name: "Dhruv Jurel", category: "Batsman", base_price: 500000 },
  { name: "Brandon King", category: "Batsman", base_price: 500000 },
  { name: "Jitesh Sharma", category: "Batsman", base_price: 500000 },
  { name: "Wayne Madsen", category: "Batsman", base_price: 50000 },
];

// ==========================================
// DEFAULT AUCTION ROUNDS
// ==========================================
const defaultRounds = [
  { roundNumber: 0, name: "Unsold Players", status: "pending" },
  { roundNumber: 1, name: "Round 1 - Batsmen", status: "pending" },
  { roundNumber: 2, name: "Round 2 - Bowlers", status: "pending" },
  { roundNumber: 3, name: "Round 3 - All-Rounders", status: "pending" },
  { roundNumber: 4, name: "Round 4 - Wicket-Keepers", status: "pending" },
  { roundNumber: 5, name: "Round 5 - Special", status: "pending" },
  { roundNumber: 6, name: "Round 6 - Final", status: "pending" },
];

// ==========================================
// AUTHORIZED ADMINS
// ==========================================
const defaultAdmins = [
  { discordId: "256972361918578688", name: "CT Owner", role: "super_admin" },
  { discordId: "1111497896018313268", name: "PS Owner", role: "super_admin" },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // ==========================================
    // SEED TEAMS
    // ==========================================
    console.log('📦 Seeding teams...');
    
    for (const [teamName, teamData] of Object.entries(teamsData)) {
      // Check if team exists
      const existingTeam = await db
        .select()
        .from(teams)
        .where(eq(teams.name, teamName))
        .limit(1);

      let teamId: number;

      if (existingTeam.length > 0) {
        // Update existing team
        await db.update(teams).set({
          ownerId: String(teamData.owner),
          purse: teamData.purse,
          maxSize: teamData.max_size,
        }).where(eq(teams.id, existingTeam[0].id));
        teamId = existingTeam[0].id;
        console.log(`  ✓ Updated team: ${teamName}`);
      } else {
        // Create new team
        const [newTeam] = await db.insert(teams).values({
          name: teamName,
          ownerId: String(teamData.owner),
          purse: teamData.purse,
          maxSize: teamData.max_size,
          createdAt: new Date().toISOString(),
        }).returning();
        teamId = newTeam.id;
        console.log(`  ✓ Created team: ${teamName}`);
      }

      // Clear existing players for this team
      await db.delete(players).where(eq(players.teamId, teamId));

      // Add players
      if (teamData.players.length > 0) {
        const playerInserts = teamData.players.map((playerName, idx) => ({
          playerId: `${teamName.toLowerCase()}_${idx}_${Date.now()}`,
          name: playerName,
          teamId: teamId,
          purchasePrice: 0,
        }));
        await db.insert(players).values(playerInserts);
        console.log(`    → Added ${teamData.players.length} players`);
      }
    }

    // ==========================================
    // SEED AUCTION ROUNDS
    // ==========================================
    console.log('\n📦 Seeding auction rounds...');
    
    for (const round of defaultRounds) {
      const existingRound = await db
        .select()
        .from(auctionRounds)
        .where(eq(auctionRounds.roundNumber, round.roundNumber))
        .limit(1);

      if (existingRound.length === 0) {
        await db.insert(auctionRounds).values({
          roundNumber: round.roundNumber,
          name: round.name,
          status: round.status,
          createdAt: new Date().toISOString(),
        });
        console.log(`  ✓ Created round: ${round.name}`);
      } else {
        console.log(`  - Round exists: ${round.name}`);
      }
    }

    // ==========================================
    // SEED ROUND 1 PLAYERS
    // ==========================================
    console.log('\n📦 Seeding Round 1 players...');
    
    // Get Round 1
    const [round1] = await db
      .select()
      .from(auctionRounds)
      .where(eq(auctionRounds.roundNumber, 1))
      .limit(1);

    if (round1) {
      // Check if players already exist
      const existingPlayers = await db
        .select()
        .from(auctionPlayers)
        .where(eq(auctionPlayers.roundId, round1.id));

      if (existingPlayers.length === 0) {
        const playerInserts = round1Players.map((player, idx) => ({
          roundId: round1.id,
          name: player.name,
          category: player.category,
          basePrice: player.base_price,
          status: 'pending',
          orderIndex: idx,
        }));

        await db.insert(auctionPlayers).values(playerInserts);
        console.log(`  ✓ Added ${round1Players.length} players to Round 1`);
      } else {
        console.log(`  - Round 1 players already exist (${existingPlayers.length} players)`);
      }
    }

    // ==========================================
    // SEED AUTHORIZED ADMINS
    // ==========================================
    console.log('\n📦 Seeding authorized admins...');
    
    for (const admin of defaultAdmins) {
      const existingAdmin = await db
        .select()
        .from(authorizedAdmins)
        .where(eq(authorizedAdmins.discordId, admin.discordId))
        .limit(1);

      if (existingAdmin.length === 0) {
        await db.insert(authorizedAdmins).values({
          discordId: admin.discordId,
          name: admin.name,
          role: admin.role,
          createdAt: new Date().toISOString(),
        });
        console.log(`  ✓ Added admin: ${admin.name} (${admin.discordId})`);
      } else {
        console.log(`  - Admin exists: ${admin.name}`);
      }
    }

    // ==========================================
    // INITIALIZE AUCTION STATE
    // ==========================================
    console.log('\n📦 Initializing auction state...');
    
    const existingState = await db.select().from(auctionState).limit(1);
    
    if (existingState.length === 0) {
      await db.insert(auctionState).values({
        status: 'idle',
        remainingTime: 10,
        updatedAt: new Date().toISOString(),
      });
      console.log('  ✓ Created auction state');
    } else {
      console.log('  - Auction state already exists');
    }

    console.log('\n✅ Seed completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
