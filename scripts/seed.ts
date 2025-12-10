// scripts/seed.ts
// Run with: npx tsx scripts/seed.ts

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../src/db/schema';

// Sample data based on your auction_data.json
const teamsData = {
  "SKR": {
    owner: "1127099249226690652",
    max_size: 20,
    purse: 50000000,
    players: ["Ben Stokes", "Quinton de Kock", "Rashid Khan", "Josh Hazlewood", "Mitchell Santner", "Mitch Marsh", "Shreyas Iyer", "Virat Kohli"]
  },
  "CT": {
    owner: "256972361918578688",
    max_size: 20,
    purse: 47250000,
    players: ["Steve Smith", "Matt Henry", "Sanju Samson", "Glenn Maxwell", "Mohammed Shami", "Salman Ali Agha", "Shakib Al Hasan", "Saud Shakeel", "Jonny Bairstow", "Tristan Stubbs", "Ruturaj Gaikwad", "Kyle Mayers", "Johnson Charles"]
  },
  "RR": {
    owner: "581514869879078931",
    max_size: 20,
    purse: 50000000,
    players: ["Jasprit Bumrah", "Rohit Sharma", "Ishan Kishan", "Rishab Pant", "Axar Patel", "Washington Sundar", "Marcus Stoinis", "Cameron Green", "Beau Webster"]
  },
  "PS": {
    owner: "1111497896018313268",
    max_size: 20,
    purse: 52000000,
    players: ["Shubman Gill", "Kagiso Rabada", "Phil Salt", "Nicholas Pooran", "Hardik Pandya", "Glenn Phillips", "Adam Zampa", "Abhishek Sharma", "Surya Kumar Yadav", "Dhruv Jurel"]
  },
  "CC": {
    owner: "447509310679810054",
    max_size: 20,
    purse: 50000000,
    players: ["Moeen Ali", "Liam Livingstone", "Andre Russell", "Harry Brook", "Joe Root", "Luke Wood", "Adil Rashid", "Ben Duckett", "Imam-ul-Haq"]
  },
  "BABT": {
    owner: "585802481779474466",
    max_size: 20,
    purse: 50000000,
    players: ["Kane Williamson", "Yashasvi Jaiswal", "Daryl Mitchell", "KL Rahul", "Ravindra Jadeja", "Kuldeep Yadav", "Alex Hales", "Matheesha Pathirana"]
  },
  "KKK": {
    owner: "485543064266604581",
    max_size: 20,
    purse: 50000000,
    players: ["Babar Azam", "Shan Masood", "Mitchell Starc", "Sikandar Raza", "Moises Henriques", "David Miller", "Rassie van der Dussen", "Devon Conway", "Johnson Charles"]
  },
  "HH": {
    owner: "432404829374119948",
    max_size: 20,
    purse: 46000000,
    players: ["Jos Butler", "Heinrich Klassen", "Shaheen Shah Afridi", "Will Jacks", "Abrar Ahmed", "Aiden Markram", "Travis Head", "Pat Cummins", "Jake Fraser-McGurk", "Labuschagne"]
  },
  "MM": {
    owner: "1332483496186220564",
    max_size: 20,
    purse: 25500000,
    players: ["Mohammad Rizwan", "Jason Roy", "Michael Bracewell", "Tim David", "Romario Shepherd", "Mark Wood", "Shamar Joseph", "Ravi Bishnoi", "Dewald Brevis", "Will Young", "Surya Kumar Yadav", "Usman Khawaja", "Jake Fraser-McGurk", "Imam-ul-Haq"]
  },
  "PP": {
    owner: "736276210719391764",
    max_size: 20,
    purse: 72000000,
    players: ["Marco Jansen", "Naseem Shah", "James Neesham", "Colin Munro", "Rinku Singh", "Sunil Narine", "Rilee Rossouw", "Finn Allen", "Tom Latham", "Matt Short"]
  }
};

// Round 1 sample data
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
];

async function seed() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client, { schema });

  console.log('🌱 Seeding database...');

  // Create teams
  console.log('Creating teams...');
  for (const [teamName, teamData] of Object.entries(teamsData)) {
    const [team] = await db.insert(schema.teams).values({
      name: teamName,
      ownerId: teamData.owner,
      maxSize: teamData.max_size,
      purse: teamData.purse,
    }).returning();

    // Add players
    for (const playerName of teamData.players) {
      await db.insert(schema.players).values({
        playerId: `seed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: playerName,
        teamId: team.id,
      });
    }

    console.log(`  ✓ Created team: ${teamName}`);
  }

  // Create auction round 1
  console.log('Creating auction round 1...');
  const [round1] = await db.insert(schema.auctionRounds).values({
    roundNumber: 1,
    name: 'Round 1 - Batsmen',
    isActive: false,
    isCompleted: false,
  }).returning();

  // Add players to round 1
  for (let i = 0; i < round1Players.length; i++) {
    const player = round1Players[i];
    await db.insert(schema.auctionPlayers).values({
      roundId: round1.id,
      name: player.name,
      category: player.category,
      basePrice: player.base_price,
      status: 'pending',
      orderIndex: i,
    });
  }
  console.log(`  ✓ Added ${round1Players.length} players to Round 1`);

  // Create empty rounds 2-6
  for (let i = 2; i <= 6; i++) {
    await db.insert(schema.auctionRounds).values({
      roundNumber: i,
      name: `Round ${i}`,
      isActive: false,
      isCompleted: false,
    });
    console.log(`  ✓ Created Round ${i}`);
  }

  // Create initial auction state
  await db.insert(schema.auctionState).values({
    isActive: false,
    isPaused: false,
  });
  console.log('  ✓ Created auction state');

  console.log('✅ Seeding complete!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
