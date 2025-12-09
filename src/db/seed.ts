import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { teams, players, trades } from './schema';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

const teamsData = {
  "BABT": { "owner_id": "585802481779474466", "players": [{ "name": "Alex Hales", "id": "lexh7031" }, { "name": "Shreyas Iyer", "id": "hrey6697" }, { "name": "Yashasvi Jaiswal", "id": "hasv1548" }, { "name": "Mathisa Pathirana", "id": "math2845" }, { "name": "Kuldeep Yadav", "id": "kuld3319" }, { "name": "Stuart Broad", "id": "stua5690" }, { "name": "Tom Latham", "id": "toml6822" }, { "name": "Vijay Shankar", "id": "aysh2785" }, { "name": "Tabraiz Shamsi", "id": "tabr4028" }, { "name": "Adam Milne", "id": "damm4228" }, { "name": "Azam Khan", "id": "azam6167" }, { "name": "KL Rahul", "id": "klra7788" }, { "name": "Daryl Mitchell", "id": "dary4438" }, { "name": "T Natarajan", "id": "tnat9173" }, { "name": "Ravindra Jadeja", "id": "vind9862" }, { "name": "Tristan Stubbs", "id": "rist5147" }], "max_size": 20 },
  "CC": { "owner_id": "447509310679810054", "players": [{ "name": "Joe Root", "id": "joer2064" }, { "name": "Harry Brook", "id": "harr9603" }, { "name": "Jonny Bairstow", "id": "jonn8052" }, { "name": "Andre Russell", "id": "drer1020" }, { "name": "Liam Livingston", "id": "liam6194" }, { "name": "Moen Ali", "id": "moee7456" }, { "name": "Luke Wood", "id": "luke3429" }, { "name": "Adil Rashid", "id": "dilr6797" }, { "name": "Ben Duckett", "id": "bend4639" }, { "name": "Mohammad Nabi", "id": "madn9374" }, { "name": "Lewis Gregory", "id": "lewi3307" }, { "name": "James Anderson", "id": "jame1465" }, { "name": "Chris Gayle", "id": "hris8414" }, { "name": "Jhye Richardson", "id": "jhye6926" }, { "name": "Jamie Smith", "id": "jami8024" }, { "name": "Dan Lawrence", "id": "danl6789" }, { "name": "Sam Billings", "id": "ambi1727" }, { "name": "Gus Atkinson", "id": "gusa9051" }, { "name": "Ish Sodhi", "id": "shso8516" }, { "name": "Mark Chapman", "id": "mark8317" }], "max_size": 20 },
  "DC": { "owner_id": "532735646477844501", "players": [{ "name": "Travis Head", "id": "avis9833" }, { "name": "Shahin Afridi", "id": "hahe4815" }, { "name": "Venkatesh Iyer", "id": "enka6012" }, { "name": "Matt Henry", "id": "tthe5386" }, { "name": "Rinku Singh", "id": "inku8232" }, { "name": "Lockie Ferguson", "id": "lock2619" }, { "name": "Shakib Al Hasan", "id": "akib2475" }, { "name": "Prithvi Shaw", "id": "ithv1740" }, { "name": "Marnus Labuschagne", "id": "rcus8584" }, { "name": "Josh Inglis", "id": "oshi2995" }, { "name": "Shai Hope", "id": "shai2696" }, { "name": "Tom Curran", "id": "tomc1059" }, { "name": "James Fuller", "id": "mesf5519" }, { "name": "Faf du Plessis", "id": "fafd3747" }, { "name": "Jamie Smith", "id": "jami8024" }, { "name": "Roston Chase", "id": "rost8086" }, { "name": "Dan Lawrence", "id": "danl6789" }, { "name": "Alzarri Joseph", "id": "alza4563" }, { "name": "K Gowtham", "id": "shna3089" }, { "name": "Brandon King", "id": "rand3860" }], "max_size": 20 },
  "PP": { "owner_id": "736276210719391764", "players": [{ "name": "Rilee Rossouw", "id": "rile1638" }, { "name": "Sunil Narine", "id": "niln3243" }, { "name": "Tom Blundell", "id": "ombl7188" }, { "name": "Tom Banton", "id": "omba6767" }, { "name": "DArcy Short", "id": "arcy2486" }, { "name": "Jason Holder", "id": "jaso6438" }, { "name": "Zaman Khan", "id": "zama6301" }, { "name": "Riyan Parag", "id": "riya5728" }, { "name": "Jamie Overton", "id": "mieo7471" }, { "name": "Venky Iyer", "id": "enka6012" }, { "name": "Colin Munro", "id": "coli4110" }, { "name": "Rahmanullah Gurbaz", "id": "ahma3320" }, { "name": "Naseem Shah", "id": "eems5953" }, { "name": "Tilak Varma", "id": "ilak9150" }, { "name": "Rinku singh", "id": "inku8232" }, { "name": "Saim Ayub", "id": "sama2972" }, { "name": "Tom Curran", "id": "tomc1059" }, { "name": "Johnson Charles", "id": "Ohns2670" }, { "name": "Marco Jansen", "id": "arco8920" }, { "name": "James Neesham", "id": "jimm7534" }], "max_size": 20 },
  "RR": { "owner_id": "581514869879078931", "players": [{ "name": "Ishan Kishan", "id": "hank2145" }, { "name": "Jasprit Bumrah", "id": "jasp8200" }, { "name": "Rakheem Cornwall", "id": "rahk6481" }, { "name": "Dhruv Jurel", "id": "hruv6489" }, { "name": "Keemo Paul", "id": "keem5045" }, { "name": "Yuzvendra Chahal", "id": "Yupc9096" }, { "name": "Surya Kumar Yadav", "id": "urya6390" }, { "name": "Harshit Rana", "id": "shit8188" }, { "name": "Varun Chakaravarthy", "id": "varu1213" }, { "name": "Gowtham", "id": "shna3089" }, { "name": "Arshdeep Singh", "id": "rshd4857" }, { "name": "Kyle Mayer", "id": "kyle5644" }, { "name": "Cameron Green", "id": "amer9338" }, { "name": "Marcus Stoinis", "id": "stoi1533" }, { "name": "Henry Nicholls", "id": "henr6401" }, { "name": "Rishabh Pant", "id": "habh1905" }, { "name": "Axar Patel", "id": "axar4454" }, { "name": "Carlos Brathwaite", "id": "carl1679" }, { "name": "Rohit Sharma", "id": "hits9213" }, { "name": "Washington Sundar", "id": "wash5678" }], "max_size": 20 },
  "SS": { "owner_id": "588612578435923980", "players": [{ "name": "Devon Conway", "id": "devo5005" }, { "name": "David Miller", "id": "davi9906" }, { "name": "Wanindu Hasaranga", "id": "wani8824" }, { "name": "Dasun Shanaka", "id": "dasu5659" }, { "name": "Rassie van der Dussen", "id": "rass1001" }, { "name": "Shikhar Dhawan", "id": "shik6229" }, { "name": "Jake Fraser-McGurk", "id": "jfkv6524" }, { "name": "Anrich Nortje", "id": "anri7978" }, { "name": "Sikandar Raza", "id": "sika1663" }, { "name": "Brydon Carse", "id": "brys5706" }, { "name": "Wayne Parnell", "id": "wayn2989" }, { "name": "Moises Henriques", "id": "mois98793" }, { "name": "Mitchel Starc", "id": "itch2021" }, { "name": "Akeal Hosein", "id": "kela3826" }, { "name": "Babar Azam", "id": "araz7649" }, { "name": "Chris Woakes", "id": "risw8713" }, { "name": "Imad Wasim", "id": "madw7669" }, { "name": "Shaan Masood", "id": "nmas3742" }, { "name": "Kieron Pollard", "id": "kier5585" }], "max_size": 20 },
  "SKR": { "owner_id": "1127099249226690652", "players": [{ "name": "Virat Kohli", "id": "irat1008" }, { "name": "Ben Stokes", "id": "enst1486" }, { "name": "Quinton de Kock", "id": "uint9629" }, { "name": "Rashid Khan", "id": "hidk1935" }, { "name": "Ravi Ashwin", "id": "vich5129" }, { "name": "Josh Hazlewood", "id": "oshh9627" }, { "name": "Trent Boult", "id": "rent7226" }, { "name": "Rovman Powell", "id": "powe7536" }, { "name": "Mohammad Haris", "id": "mmad8433" }, { "name": "Jitesh Sharma", "id": "jite3023" }, { "name": "Wayne Madsen", "id": "wayn8961" }, { "name": "Mitchell Santner", "id": "antn4491" }, { "name": "Gulbadin Naib", "id": "gulb6106" }, { "name": "Jhye Richardson", "id": "jhye6926" }, { "name": "Zak Crawley", "id": "Zakc8275" }, { "name": "Jaydev Unadkat", "id": "jayd4941" }, { "name": "Kane Williamson", "id": "kane6895" }, { "name": "Mitch Marsh", "id": "/mitc8795" }, { "name": "george garton", "id": "eorg2586" }, { "name": "Shreyas Iyer", "id": "hrey6697" }], "max_size": 20 },
  "CT": { "owner_id": "256972361918578688", "players": [{ "name": "Steve Smith", "id": "eves3355" }, { "name": "Sanju Samson", "id": "anju9621" }, { "name": "Salman Ali Agha", "id": "alma8915" }, { "name": "Mohammed Shami", "id": "hami6099" }, { "name": "Haris Rauf", "id": "risr2563" }, { "name": "David Willey", "id": "idwi7967" }, { "name": "Glenn Maxwell", "id": "glen4231" }, { "name": "Fakhar Zaman", "id": "khar1705" }, { "name": "Tim Seifert", "id": "tims4871" }, { "name": "Azhar Ali", "id": "azha5947" }, { "name": "Hassan Ali", "id": "sana3809" }, { "name": "Saud Shakeel", "id": "saud1101" }, { "name": "Sajid Khan", "id": "jidk5776" }, { "name": "Ashton Agar", "id": "asht7861" }, { "name": "Shimron Hetmyer", "id": "shri2800" }, { "name": "Matt Henry", "id": "tthe5386" }, { "name": "Faf du Plessis", "id": "fafd3747" }, { "name": "Shakib Al Hasan", "id": "akib2475" }, { "name": "Lockie Fergurson", "id": "lock2619" }, { "name": "marnus labuschagne", "id": "icus8584" }], "max_size": 20 },
  "HH": { "owner_id": "432404829374119948", "players": [{ "name": "Pat Cummins", "id": "atcu9485" }, { "name": "Jos Butler", "id": "josb8927" }, { "name": "Heinrich Klassen", "id": "hein2464" }, { "name": "Dwayne Bravo", "id": "dway1079" }, { "name": "Abrar Ahmed", "id": "bram1823" }, { "name": "Keshav Maharaj", "id": "ahar1944" }, { "name": "Will Jacks", "id": "will7594" }, { "name": "Aamer Jamal", "id": "aame9399" }, { "name": "Chris Jordan", "id": "risj3966" }, { "name": "Noman Ali", "id": "noma8815" }, { "name": "Imam-ul-Haq", "id": "imam3727" }, { "name": "Craig Overton", "id": "crai3943" }, { "name": "Evin Lewis", "id": "evin5952" }, { "name": "Finn Allen", "id": "finn1055" }, { "name": "Travis Head", "id": "avis9833" }, { "name": "Odean Smith", "id": "odea5543" }, { "name": "Kyle Jamieson", "id": "kyle6220" }, { "name": "Obed McCoy", "id": "obed5463" }, { "name": "Shaheen Shah Afridi", "id": "hahe4815" }, { "name": "Aiden Markram", "id": "aide3236" }], "max_size": 20 },
  "PS": { "owner_id": "1111497896018313268", "players": [{ "name": "David Warner", "id": "avid9639" }, { "name": "Adam Zampa", "id": "adam2163" }, { "name": "Nathan Lyon", "id": "hanl9870" }, { "name": "Glenn Phillips", "id": "ennp6526" }, { "name": "Nicholas Pooran", "id": "nich4863" }, { "name": "Matthew Wade", "id": "tthe7454" }, { "name": "Hardik Pandya", "id": "hard3380" }, { "name": "Rachin Ravindra", "id": "Rach 9532" }, { "name": "Phil Salt", "id": "phil4024" }, { "name": "Bhuvneshwar Kumar", "id": "huvn4541" }, { "name": "Sam Curran", "id": "samc3810" }, { "name": "Sandeep Sharma", "id": "ande5358" }, { "name": "Jofra Archer", "id": "jofr1908" }, { "name": "Liam Dawson", "id": "liam7628" }, { "name": "Roston Chase", "id": "rost8086" }, { "name": "Jacob Bethell", "id": "jaco9445" }, { "name": "Kagiso Rabada", "id": "kagi6181" }, { "name": "Shubman Gill", "id": "hubm8356" }, { "name": "Abhishek Sharma", "id": "bhis8927" }, { "name": "Josh Inglis", "id": "oshi2995" }], "max_size": 20 },
  "MM": { "owner_id": "1332483496186220564", "players": [{ "name": "Mohammed Rizwan", "id": "mmad4853" }, { "name": "Dawid Malan", "id": "awid6426" }, { "name": "James Vince", "id": "mesv1252" }, { "name": "Martin Guptill", "id": "rtin4698" }, { "name": "Tim Southee", "id": "imso7130" }, { "name": "Shamar Joseph", "id": "hama9711" }, { "name": "Jason Roy", "id": "ason2708" }, { "name": "Usman Khawaja", "id": "mank3154" }, { "name": "Roelof van der Merwe", "id": "roel7090" }, { "name": "Rahul Tewatia", "id": "hult7025" }, { "name": "Harshal Patel", "id": "halp5849" }, { "name": "Michael Bracewell", "id": "icha8183" }, { "name": "Romario Shepherd", "id": "roma6362" }, { "name": "Ravi Bishnoi", "id": "avib5967" }, { "name": "Umesh Yadav", "id": "shya4418" }, { "name": "Rahul Chahar", "id": "hulc5221" }, { "name": "Mark Wood", "id": "arkw9033" }, { "name": "James Fuller", "id": "mesf5519" }, { "name": "Tim David", "id": "imda7872" }], "max_size": 20 }
};

const tradesData = [
  { timestamp: "2024-11-23T21:24:13.429393", team1: "CT", team2: "SKR", players1: [{ id: "rist5147", name: "Tristan Stubbs" }, { id: "eorg2586", name: "George Garton" }], players2: [{ id: "klra7788", name: "KL Rahul" }, { id: "asht7861", name: "Ashton Agar" }] },
  { timestamp: "2024-11-23T21:44:13.253681", team1: "SS", team2: "RR", players1: [{ id: "urya6390", name: "Surya Kumar Yadav" }], players2: [{ id: "itch2021", name: "Mitchel Starc" }] },
  { timestamp: "2025-01-03T03:47:22.169738", team1: "RR", team2: "PS", players1: [{ id: "rshd4857", name: "Arshdeep Singh" }], players2: [{ id: "shit8188", name: "Harshit Rana" }] },
  { timestamp: "2025-03-14T02:05:03.988712", team1: "RR", team2: "BABT", players1: [{ id: "dary4438", name: "Daryl Mitchell" }, { id: "tnat9173", name: "T Natarajan" }], players2: [{ id: "varu1213", name: "Varun Chakaravarthy" }, { id: "huvn4541", name: "Bhuvneshwar Kumar" }] },
  { timestamp: "2025-04-12T05:27:04.681563", team1: "RR", team2: "PS", players1: [{ id: "phil4024", name: "Phil Salt" }, { id: "huvn4541", name: "Bhuvneshwar Kumar" }, { id: "samc3810", name: "Sam Curran" }], players2: [{ id: "habh1905", name: "Rishabh Pant" }, { id: "eems5953", name: "Naseem Shah" }, { id: "ande5358", name: "Sandeep Sharma" }] },
  { timestamp: "2025-05-25T06:56:08.633180", team1: "RR", team2: "CT", players1: [{ id: "shri2800", name: "Shimron Hetmyer" }], players2: [{ id: "rist5147", name: "Tristan Stubbs" }] },
  { timestamp: "2025-07-27T13:00:33.843746", team1: "RR", team2: "PS", players1: [{ id: "jofr1908", name: "Jofra Archer" }], players2: [{ id: "rshd4857", name: "Arshdeep Singh" }] },
  { timestamp: "2025-08-24T18:26:11.162386", team1: "HH", team2: "KK", players1: [{ id: "bhis8927", name: "Abhishek Sharma" }, { id: "ahma3320", name: "Rahmanullah Gurbaz" }], players2: [{ id: "hahe4815", name: "Shaheen Shah Afridi" }, { id: "vind9862", name: "Ravindra Jadeja" }] },
  { timestamp: "2025-09-14T16:17:47.189114", team1: "PS", team2: "SS", players1: [{ id: "araz7649", name: "Babar Azam" }], players2: [{ id: "hits9213", name: "Rohit Sharma" }] },
  { timestamp: "2025-10-08T04:31:00.029825", team1: "PS", team2: "RR", players1: [{ id: "hits9213", name: "Rohit Sharma" }], players2: [{ id: "bhis8927", name: "Abhishek Sharma" }] },
  { timestamp: "2025-11-23T04:23:38.612840", team1: "RR", team2: "BABT", players1: [{ id: "rist5147", name: "Tristan Stubbs" }], players2: [{ id: "wash5678", name: "Washington Sundar" }] },
  { timestamp: "2025-11-23T17:31:49.557092", team1: "PS", team2: "MM", players1: [{ id: "imda7872", name: "Tim David" }], players2: [{ id: "oshi2995", name: "Josh Inglis" }] },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await db.delete(trades);
  await db.delete(players);
  await db.delete(teams);

  // Insert teams and players
  for (const [teamName, teamData] of Object.entries(teamsData)) {
    const [team] = await db.insert(teams).values({
      name: teamName,
      ownerId: teamData.owner_id,
      maxSize: teamData.max_size,
      createdAt: new Date().toISOString(),
    }).returning();

    for (const player of teamData.players) {
      await db.insert(players).values({
        playerId: player.id,
        name: player.name,
        teamId: team.id,
      }).onConflictDoNothing();
    }

    console.log(`✓ Created team: ${teamName} with ${teamData.players.length} players`);
  }

  // Insert trades
  for (const trade of tradesData) {
    await db.insert(trades).values({
      timestamp: trade.timestamp,
      team1Name: trade.team1,
      team2Name: trade.team2,
      players1: JSON.stringify(trade.players1),
      players2: JSON.stringify(trade.players2),
    });
  }

  console.log(`✓ Inserted ${tradesData.length} trades`);
  console.log('✅ Seeding complete!');
}

seed().catch(console.error);
