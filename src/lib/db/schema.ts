import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Teams table
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  ownerId: text('owner_id').notNull(),
  ownerName: text('owner_name'),
  purse: integer('purse').notNull().default(50000000),
  maxSize: integer('max_size').notNull().default(20),
  players: text('players').default('[]'), // JSON array of player objects
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow()
});

// Players table (main roster)
export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  category: text('category'),
  purchasePrice: integer('purchase_price'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow()
});

// Trades table
export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fromTeamId: integer('from_team_id').references(() => teams.id),
  toTeamId: integer('to_team_id').references(() => teams.id),
  playerName: text('player_name').notNull(),
  status: text('status').default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow()
});

// Auction rounds table
export const auctionRounds = sqliteTable('auction_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  status: text('status').default('pending'), // pending, active, completed
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow()
});

// Auction players table - players available for auction in each round
export const auctionPlayers = sqliteTable('auction_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').references(() => auctionRounds.id),
  playerId: integer('player_id'), // Original player ID from import (for tracking)
  name: text('name').notNull(),
  category: text('category'),
  basePrice: integer('base_price').notNull().default(100000),
  status: text('status').default('pending'), // pending, sold, unsold
  soldTo: integer('sold_to').references(() => teams.id),
  soldPrice: integer('sold_price'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow()
});

// Auction state table - tracks current auction state
export const auctionState = sqliteTable('auction_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  currentPlayerId: integer('current_player_id').references(() => auctionPlayers.id),
  currentBid: integer('current_bid').default(0),
  highestBidderId: text('highest_bidder_id'),
  timerEndTime: integer('timer_end_time'), // Unix timestamp or remaining ms when paused
  isPaused: integer('is_paused', { mode: 'boolean' }).default(false),
  roundId: integer('round_id').references(() => auctionRounds.id)
});

// Auction logs table - tracks all auction events
export const auctionLogs = sqliteTable('auction_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(), // start, bid, sale, unsold, pause, resume, stop
  playerId: integer('player_id'),
  playerName: text('player_name'),
  teamId: integer('team_id'),
  teamName: text('team_name'),
  userId: text('user_id'),
  amount: integer('amount'),
  roundId: integer('round_id'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).defaultNow()
});

// Unsold players table
export const unsoldPlayers = sqliteTable('unsold_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id'),
  name: text('name').notNull(),
  category: text('category'),
  basePrice: integer('base_price'),
  roundId: integer('round_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow()
});
