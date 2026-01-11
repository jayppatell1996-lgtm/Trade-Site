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
  pitchSurface: text('pitch_surface'), // Soft, Medium, Heavy
  cracks: text('cracks'), // None, Light, Heavy
  status: text('status').default('upcoming'), // upcoming, live, completed
  team1Score: text('team1_score'),
  team2Score: text('team2_score'),
  winnerId: integer('winner_id').references(() => teams.id),
  result: text('result'), // e.g., "Team A won by 5 wickets"
});

// =============================================
// PHASE 1 & 2: CRICKET SCORING & PLAYER STATS
// =============================================

// Innings data for each team in a match
export const innings = sqliteTable('innings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').references(() => matches.id),
  teamId: integer('team_id').references(() => teams.id),
  inningsNumber: integer('innings_number').notNull(), // 1 or 2
  totalRuns: integer('total_runs').default(0),
  wickets: integer('wickets').default(0),
  overs: real('overs').default(0), // e.g., 15.3 for 15 overs 3 balls
  extras: integer('extras').default(0),
  wides: integer('wides').default(0),
  noBalls: integer('no_balls').default(0),
  byes: integer('byes').default(0),
  legByes: integer('leg_byes').default(0),
  runRate: real('run_rate').default(0),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  target: integer('target'), // For 2nd innings
  createdAt: text('created_at').notNull(),
});

// Ball-by-ball delivery tracking
export const deliveries = sqliteTable('deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inningsId: integer('innings_id').references(() => innings.id),
  matchId: integer('match_id').references(() => matches.id),
  overNumber: integer('over_number').notNull(), // 0-indexed (0 = 1st over)
  ballNumber: integer('ball_number').notNull(), // 1-6 (legal balls only)
  batsmanId: integer('batsman_id').references(() => players.id),
  batsmanName: text('batsman_name').notNull(),
  nonStrikerId: integer('non_striker_id').references(() => players.id),
  nonStrikerName: text('non_striker_name'),
  bowlerId: integer('bowler_id').references(() => players.id),
  bowlerName: text('bowler_name').notNull(),
  runs: integer('runs').default(0), // Runs scored by batsman
  extras: integer('extras').default(0), // Total extras on this ball
  extraType: text('extra_type'), // wide, noball, bye, legbye, null
  totalRuns: integer('total_runs').default(0), // runs + extras
  isWicket: integer('is_wicket', { mode: 'boolean' }).default(false),
  wicketType: text('wicket_type'), // bowled, caught, lbw, runout, stumped, hitwicket
  dismissedBatsmanId: integer('dismissed_batsman_id').references(() => players.id),
  dismissedBatsmanName: text('dismissed_batsman_name'),
  fielderId: integer('fielder_id').references(() => players.id),
  fielderName: text('fielder_name'),
  isFour: integer('is_four', { mode: 'boolean' }).default(false),
  isSix: integer('is_six', { mode: 'boolean' }).default(false),
  timestamp: text('timestamp').notNull(),
});

// Per-match batting performance
export const battingPerformances = sqliteTable('batting_performances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').references(() => matches.id),
  inningsId: integer('innings_id').references(() => innings.id),
  playerId: integer('player_id').references(() => players.id),
  playerName: text('player_name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  battingPosition: integer('batting_position'),
  runs: integer('runs').default(0),
  balls: integer('balls').default(0),
  fours: integer('fours').default(0),
  sixes: integer('sixes').default(0),
  strikeRate: real('strike_rate').default(0),
  isOut: integer('is_out', { mode: 'boolean' }).default(false),
  howOut: text('how_out'), // "c Fielder b Bowler", "b Bowler", "not out"
  dismissalType: text('dismissal_type'), // bowled, caught, lbw, etc.
  bowlerId: integer('bowler_id').references(() => players.id),
  bowlerName: text('bowler_name'),
  fielderId: integer('fielder_id').references(() => players.id),
  fielderName: text('fielder_name'),
  isNotOut: integer('is_not_out', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
});

// Per-match bowling performance
export const bowlingPerformances = sqliteTable('bowling_performances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').references(() => matches.id),
  inningsId: integer('innings_id').references(() => innings.id),
  playerId: integer('player_id').references(() => players.id),
  playerName: text('player_name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  overs: real('overs').default(0), // e.g., 4.0, 3.2
  maidens: integer('maidens').default(0),
  runs: integer('runs').default(0),
  wickets: integer('wickets').default(0),
  economy: real('economy').default(0),
  wides: integer('wides').default(0),
  noBalls: integer('no_balls').default(0),
  dots: integer('dots').default(0),
  fours: integer('fours_conceded').default(0),
  sixes: integer('sixes_conceded').default(0),
  createdAt: text('created_at').notNull(),
});

// Per-match fielding performance
export const fieldingPerformances = sqliteTable('fielding_performances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').references(() => matches.id),
  playerId: integer('player_id').references(() => players.id),
  playerName: text('player_name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  catches: integer('catches').default(0),
  runOuts: integer('run_outs').default(0),
  stumpings: integer('stumpings').default(0),
  createdAt: text('created_at').notNull(),
});

// Aggregated player career stats (by tournament or overall)
export const playerCareerStats = sqliteTable('player_career_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id').references(() => players.id),
  playerName: text('player_name').notNull(),
  teamId: integer('team_id').references(() => teams.id),
  tournamentId: integer('tournament_id').references(() => tournaments.id), // null = overall
  
  // Batting stats
  battingMatches: integer('batting_matches').default(0),
  battingInnings: integer('batting_innings').default(0),
  totalRuns: integer('total_runs').default(0),
  highestScore: integer('highest_score').default(0),
  highestScoreNotOut: integer('highest_score_not_out', { mode: 'boolean' }).default(false),
  battingAverage: real('batting_average').default(0),
  battingStrikeRate: real('batting_strike_rate').default(0),
  totalBalls: integer('total_balls').default(0),
  totalFours: integer('total_fours').default(0),
  totalSixes: integer('total_sixes').default(0),
  fifties: integer('fifties').default(0),
  hundreds: integer('hundreds').default(0),
  ducks: integer('ducks').default(0),
  notOuts: integer('not_outs').default(0),
  
  // Bowling stats
  bowlingMatches: integer('bowling_matches').default(0),
  bowlingInnings: integer('bowling_innings').default(0),
  totalOvers: real('total_overs').default(0),
  totalMaidens: integer('total_maidens').default(0),
  totalRunsConceded: integer('total_runs_conceded').default(0),
  totalWickets: integer('total_wickets').default(0),
  bowlingAverage: real('bowling_average').default(0),
  bowlingEconomy: real('bowling_economy').default(0),
  bowlingStrikeRate: real('bowling_strike_rate').default(0),
  bestBowlingWickets: integer('best_bowling_wickets').default(0),
  bestBowlingRuns: integer('best_bowling_runs').default(0),
  threeWickets: integer('three_wickets').default(0), // 3-fers
  fiveWickets: integer('five_wickets').default(0), // 5-fers
  
  // Fielding stats
  totalCatches: integer('total_catches').default(0),
  totalRunOuts: integer('total_run_outs').default(0),
  totalStumpings: integer('total_stumpings').default(0),
  
  // Awards
  playerOfMatch: integer('player_of_match').default(0),
  
  lastUpdated: text('last_updated').notNull(),
});

// Match events/commentary timeline
export const matchEvents = sqliteTable('match_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').references(() => matches.id),
  inningsId: integer('innings_id').references(() => innings.id),
  eventType: text('event_type').notNull(), // wicket, boundary, milestone, over_end, innings_end, match_start, match_end
  overNumber: integer('over_number'),
  ballNumber: integer('ball_number'),
  description: text('description').notNull(),
  timestamp: text('timestamp').notNull(),
});

// Current match scoring state (for live matches)
export const liveMatchState = sqliteTable('live_match_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').references(() => matches.id).unique(),
  currentInningsId: integer('current_innings_id').references(() => innings.id),
  currentInningsNumber: integer('current_innings_number').default(1),
  battingTeamId: integer('batting_team_id').references(() => teams.id),
  bowlingTeamId: integer('bowling_team_id').references(() => teams.id),
  strikerId: integer('striker_id').references(() => players.id),
  strikerName: text('striker_name'),
  nonStrikerId: integer('non_striker_id').references(() => players.id),
  nonStrikerName: text('non_striker_name'),
  currentBowlerId: integer('current_bowler_id').references(() => players.id),
  currentBowlerName: text('current_bowler_name'),
  currentOver: integer('current_over').default(0),
  currentBall: integer('current_ball').default(0), // balls in current over
  isLive: integer('is_live', { mode: 'boolean' }).default(false),
  isPaused: integer('is_paused', { mode: 'boolean' }).default(false),
  lastUpdated: text('last_updated').notNull(),
});

// Partnerships tracking
export const partnerships = sqliteTable('partnerships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inningsId: integer('innings_id').references(() => innings.id),
  matchId: integer('match_id').references(() => matches.id),
  wicketNumber: integer('wicket_number').notNull(), // Partnership for which wicket
  batsman1Id: integer('batsman1_id').references(() => players.id),
  batsman1Name: text('batsman1_name').notNull(),
  batsman1Runs: integer('batsman1_runs').default(0),
  batsman1Balls: integer('batsman1_balls').default(0),
  batsman2Id: integer('batsman2_id').references(() => players.id),
  batsman2Name: text('batsman2_name').notNull(),
  batsman2Runs: integer('batsman2_runs').default(0),
  batsman2Balls: integer('batsman2_balls').default(0),
  totalRuns: integer('total_runs').default(0),
  totalBalls: integer('total_balls').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
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
export type Innings = typeof innings.$inferSelect;
export type NewInnings = typeof innings.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;
export type BattingPerformance = typeof battingPerformances.$inferSelect;
export type NewBattingPerformance = typeof battingPerformances.$inferInsert;
export type BowlingPerformance = typeof bowlingPerformances.$inferSelect;
export type NewBowlingPerformance = typeof bowlingPerformances.$inferInsert;
export type FieldingPerformance = typeof fieldingPerformances.$inferSelect;
export type PlayerCareerStats = typeof playerCareerStats.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type LiveMatchState = typeof liveMatchState.$inferSelect;
export type Partnership = typeof partnerships.$inferSelect;
