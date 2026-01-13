import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Teams table
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  ownerId: text('owner_id').notNull(), // Discord ID
  ownerName: text('owner_name'),
  maxSize: integer('max_size').notNull().default(20),
  purse: real('purse').notNull().default(50000000),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Players on teams
export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: text('player_id').notNull(),
  name: text('name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  category: text('category'),
  boughtFor: real('bought_for'),
});

// Trade history (completed trades)
export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  team1Name: text('team1_name').notNull(),
  team2Name: text('team2_name').notNull(),
  players1: text('players1').notNull(), // JSON array
  players2: text('players2').notNull(), // JSON array
});

// Pending trade proposals
export const pendingTrades = sqliteTable('pending_trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  proposerId: text('proposer_id').notNull(), // Discord ID of proposer
  proposerTeamId: integer('proposer_team_id').references(() => teams.id),
  proposerTeamName: text('proposer_team_name').notNull(),
  targetId: text('target_id').notNull(), // Discord ID of target owner
  targetTeamId: integer('target_team_id').references(() => teams.id),
  targetTeamName: text('target_team_name').notNull(),
  proposerPlayers: text('proposer_players').notNull(), // JSON array of player names
  targetPlayers: text('target_players').notNull(), // JSON array of player names
  status: text('status').default('pending'), // pending, accepted, rejected, cancelled
  message: text('message'), // Optional message from proposer
  createdAt: text('created_at').notNull(),
  respondedAt: text('responded_at'),
});

// Auction rounds (6 rounds)
export const auctionRounds = sqliteTable('auction_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundNumber: integer('round_number').notNull(),
  name: text('name').notNull(), // e.g., "Round 1 - Batsmen"
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Players available for auction in each round
export const auctionPlayers = sqliteTable('auction_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').references(() => auctionRounds.id),
  playerId: text('player_id'), // Player ID from import data
  name: text('name').notNull(),
  category: text('category').notNull(),
  basePrice: real('base_price').notNull(),
  status: text('status').default('pending'), // pending, current, sold, unsold
  soldTo: text('sold_to'), // Team name
  soldFor: real('sold_for'),
  soldAt: text('sold_at'),
  orderIndex: integer('order_index').default(0),
});

// Current auction state
export const auctionState = sqliteTable('auction_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  isPaused: integer('is_paused', { mode: 'boolean' }).default(false),
  currentRoundId: integer('current_round_id').references(() => auctionRounds.id),
  currentPlayerId: integer('current_player_id').references(() => auctionPlayers.id),
  currentBid: real('current_bid').default(0),
  highestBidderId: text('highest_bidder_id'), // Discord ID
  highestBidderTeam: text('highest_bidder_team'),
  timerEndTime: integer('timer_end_time'), // Unix timestamp
  pausedTimeRemaining: integer('paused_time_remaining'), // Milliseconds remaining when paused
  lastUpdated: text('last_updated'),
});

// Auction logs
export const auctionLogs = sqliteTable('auction_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').references(() => auctionRounds.id),
  message: text('message').notNull(),
  logType: text('log_type'), // sale, unsold, pause, resume, start, stop
  timestamp: text('timestamp').notNull(),
});

// Unsold players pool
export const unsoldPlayers = sqliteTable('unsold_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  basePrice: real('base_price').notNull(),
  originalRoundId: integer('original_round_id'),
  addedAt: text('added_at'),
});

// Tournaments/Fixtures
export const tournaments = sqliteTable('tournaments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  country: text('country').notNull(),
  numberOfGroups: integer('number_of_groups').notNull().default(1),
  roundRobinType: text('round_robin_type').notNull().default('single'), // 'single' or 'double'
  status: text('status').default('upcoming'), // upcoming, ongoing, completed
  createdAt: text('created_at').notNull(),
  // Playoff configuration
  hasPlayoffs: integer('has_playoffs', { mode: 'boolean' }).default(false),
  playoffStyle: text('playoff_style'), // 'ipl' (4 teams) or 'traditional' (2/4/8 teams)
  playoffTeams: integer('playoff_teams'), // Number of teams in playoffs (2, 4, 8)
});

// Tournament Groups
export const tournamentGroups = sqliteTable('tournament_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tournamentId: integer('tournament_id').references(() => tournaments.id),
  name: text('name').notNull(), // e.g., "Group A", "Group B"
  orderIndex: integer('order_index').default(0),
});

// Teams in Groups
export const groupTeams = sqliteTable('group_teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').references(() => tournamentGroups.id),
  teamId: integer('team_id').references(() => teams.id),
  played: integer('played').default(0),
  won: integer('won').default(0),
  lost: integer('lost').default(0),
  tied: integer('tied').default(0),
  nrr: real('nrr').default(0),
  points: integer('points').default(0),
});

// Matches/Fixtures
export const matches = sqliteTable('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tournamentId: integer('tournament_id').references(() => tournaments.id),
  groupId: integer('group_id').references(() => tournamentGroups.id),
  matchNumber: integer('match_number').notNull(),
  team1Id: integer('team1_id').references(() => teams.id),
  team2Id: integer('team2_id').references(() => teams.id),
  venue: text('venue').notNull(),
  city: text('city'),
  matchDate: text('match_date'),
  matchTime: text('match_time'),
  pitchType: text('pitch_type'), // Standard, Grassy, Dry, etc.
  pitchSurface: text('pitch_surface'), // Soft, Medium, Hard
  cracks: text('cracks'), // None, Light, Heavy
  status: text('status').default('upcoming'), // upcoming, live, completed
  team1Score: text('team1_score'),
  team2Score: text('team2_score'),
  winnerId: integer('winner_id').references(() => teams.id),
  result: text('result'), // e.g., "Team A won by 5 wickets"
  stage: text('stage').default('group'), // group, qualifier1, eliminator, qualifier2, semifinal, final, quarterfinal
  stageName: text('stage_name'), // Display name like "Qualifier 1", "Semi-Final 1"
});

// Type exports
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type PendingTrade = typeof pendingTrades.$inferSelect;
export type NewPendingTrade = typeof pendingTrades.$inferInsert;
export type AuctionRound = typeof auctionRounds.$inferSelect;
export type NewAuctionRound = typeof auctionRounds.$inferInsert;
export type AuctionPlayer = typeof auctionPlayers.$inferSelect;
export type NewAuctionPlayer = typeof auctionPlayers.$inferInsert;
export type AuctionState = typeof auctionState.$inferSelect;
export type AuctionLog = typeof auctionLogs.$inferSelect;
export type UnsoldPlayer = typeof unsoldPlayers.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentGroup = typeof tournamentGroups.$inferSelect;
export type GroupTeam = typeof groupTeams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
