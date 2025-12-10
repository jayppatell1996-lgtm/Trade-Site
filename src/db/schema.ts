import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ==================== TEAMS TABLE ====================
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  ownerId: text('owner_id').notNull(), // Discord ID
  maxSize: integer('max_size').notNull().default(20),
  purse: real('purse').notNull().default(20000000), // 20 million default
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ==================== PLAYERS TABLE ====================
export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: text('player_id').notNull().unique(),
  name: text('name').notNull(),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  purchasePrice: real('purchase_price').default(0),
});

// ==================== TRADES TABLE ====================
export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  team1Name: text('team1_name').notNull(),
  team2Name: text('team2_name').notNull(),
  players1: text('players1').notNull(), // JSON string
  players2: text('players2').notNull(), // JSON string
});

// ==================== AUCTION ROUNDS TABLE ====================
// Rounds 0-6 (0 = Unsold Players pool)
export const auctionRounds = sqliteTable('auction_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundNumber: integer('round_number').notNull().unique(), // 0=unsold, 1-6 for rounds
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'), // pending, active, completed
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ==================== AUCTION PLAYERS TABLE ====================
export const auctionPlayers = sqliteTable('auction_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').notNull().references(() => auctionRounds.id),
  name: text('name').notNull(),
  category: text('category').notNull(), // Batsman, Bowler, All-Rounder, Wicket-Keeper
  basePrice: real('base_price').notNull(),
  status: text('status').notNull().default('pending'), // pending, current, sold, unsold
  soldToTeamId: integer('sold_to_team_id').references(() => teams.id),
  soldPrice: real('sold_price'),
  soldAt: text('sold_at'),
  orderIndex: integer('order_index').default(0),
}, (table) => ({
  roundIdIdx: index('auction_players_round_idx').on(table.roundId),
  statusIdx: index('auction_players_status_idx').on(table.status),
}));

// ==================== AUCTION STATE TABLE ====================
// Single row table to track current auction state
export const auctionState = sqliteTable('auction_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').references(() => auctionRounds.id),
  currentPlayerId: integer('current_player_id').references(() => auctionPlayers.id),
  currentBid: real('current_bid').default(0),
  highestBidderId: text('highest_bidder_id'), // Discord User ID
  highestBidderName: text('highest_bidder_name'),
  highestBidderTeamId: integer('highest_bidder_team_id').references(() => teams.id),
  status: text('status').notNull().default('idle'), // idle, active, paused, stopped
  remainingTime: integer('remaining_time').default(10),
  timerStartedAt: text('timer_started_at'),
  lastSalePlayer: text('last_sale_player'),
  lastSaleTeam: text('last_sale_team'),
  lastSaleAmount: real('last_sale_amount'),
  lastUnsoldPlayer: text('last_unsold_player'),
  updatedAt: text('updated_at').default(new Date().toISOString()),
});

// ==================== AUCTION LOGS TABLE ====================
export const auctionLogs = sqliteTable('auction_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').references(() => auctionRounds.id),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // info, sale, unsold, pause, resume, stop, bid, error
  createdAt: text('created_at').default(new Date().toISOString()),
}, (table) => ({
  roundIdx: index('auction_logs_round_idx').on(table.roundId),
}));

// ==================== AUCTION HISTORY TABLE ====================
export const auctionHistory = sqliteTable('auction_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerName: text('player_name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  teamName: text('team_name').notNull(),
  winningBid: real('winning_bid').notNull(),
  winnerDiscordId: text('winner_discord_id').notNull(),
  winnerDisplayName: text('winner_display_name'),
  newBalance: real('new_balance').notNull(),
  roundId: integer('round_id').references(() => auctionRounds.id),
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ==================== AUTHORIZED ADMINS TABLE ====================
// Users who can control the auction (Start, Next, Sold, Pause, Resume, Stop)
export const authorizedAdmins = sqliteTable('authorized_admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordId: text('discord_id').notNull().unique(),
  name: text('name'),
  role: text('role').notNull().default('admin'), // admin, super_admin
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ==================== RELATIONS ====================
export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
  auctionHistory: many(auctionHistory),
  wonAuctionPlayers: many(auctionPlayers),
}));

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
}));

export const auctionRoundsRelations = relations(auctionRounds, ({ many }) => ({
  auctionPlayers: many(auctionPlayers),
  auctionLogs: many(auctionLogs),
  auctionHistory: many(auctionHistory),
}));

export const auctionPlayersRelations = relations(auctionPlayers, ({ one }) => ({
  round: one(auctionRounds, {
    fields: [auctionPlayers.roundId],
    references: [auctionRounds.id],
  }),
  soldToTeam: one(teams, {
    fields: [auctionPlayers.soldToTeamId],
    references: [teams.id],
  }),
}));

// ==================== TYPE EXPORTS ====================
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
export type AuctionHistory = typeof auctionHistory.$inferSelect;
export type AuthorizedAdmin = typeof authorizedAdmins.$inferSelect;
