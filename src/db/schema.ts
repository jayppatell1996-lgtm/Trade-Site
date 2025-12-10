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

// Trade history
export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  team1Name: text('team1_name').notNull(),
  team2Name: text('team2_name').notNull(),
  players1: text('players1').notNull(), // JSON array
  players2: text('players2').notNull(), // JSON array
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

// Type exports
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type AuctionRound = typeof auctionRounds.$inferSelect;
export type NewAuctionRound = typeof auctionRounds.$inferInsert;
export type AuctionPlayer = typeof auctionPlayers.$inferSelect;
export type NewAuctionPlayer = typeof auctionPlayers.$inferInsert;
export type AuctionState = typeof auctionState.$inferSelect;
export type AuctionLog = typeof auctionLogs.$inferSelect;
export type UnsoldPlayer = typeof unsoldPlayers.$inferSelect;
