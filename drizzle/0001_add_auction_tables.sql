-- ==========================================
-- MIGRATION: Add Auction System Tables
-- Run this via Turso shell or db:push
-- ==========================================

-- Add purse column to teams if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for columns, 
-- so if purse already exists, skip this or use ALTER TABLE
ALTER TABLE teams ADD COLUMN purse REAL DEFAULT 20000000;

-- Create auction rounds table (Rounds 0-6, where 0 = Unsold)
CREATE TABLE IF NOT EXISTS auction_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create auction players table
CREATE TABLE IF NOT EXISTS auction_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES auction_rounds(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    sold_to_team_id INTEGER REFERENCES teams(id),
    sold_price REAL,
    sold_at TEXT,
    order_index INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS auction_players_round_idx ON auction_players(round_id);
CREATE INDEX IF NOT EXISTS auction_players_status_idx ON auction_players(status);

-- Create auction state table (single row for current state)
CREATE TABLE IF NOT EXISTS auction_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER REFERENCES auction_rounds(id),
    current_player_id INTEGER REFERENCES auction_players(id),
    current_bid REAL DEFAULT 0,
    highest_bidder_id TEXT,
    highest_bidder_name TEXT,
    highest_bidder_team_id INTEGER REFERENCES teams(id),
    status TEXT NOT NULL DEFAULT 'idle',
    remaining_time INTEGER DEFAULT 10,
    timer_started_at TEXT,
    last_sale_player TEXT,
    last_sale_team TEXT,
    last_sale_amount REAL,
    last_unsold_player TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create auction logs table
CREATE TABLE IF NOT EXISTS auction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER REFERENCES auction_rounds(id),
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS auction_logs_round_idx ON auction_logs(round_id);

-- Create auction history table
CREATE TABLE IF NOT EXISTS auction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    team_name TEXT NOT NULL,
    winning_bid REAL NOT NULL,
    winner_discord_id TEXT NOT NULL,
    winner_display_name TEXT,
    new_balance REAL NOT NULL,
    round_id INTEGER REFERENCES auction_rounds(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create authorized admins table
CREATE TABLE IF NOT EXISTS authorized_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INSERT DEFAULT DATA
-- ==========================================

-- Insert default auction rounds (0 = Unsold, 1-6 = Regular rounds)
INSERT OR IGNORE INTO auction_rounds (round_number, name, status) VALUES 
    (0, 'Unsold Players', 'pending'),
    (1, 'Round 1 - Batsmen', 'pending'),
    (2, 'Round 2 - Bowlers', 'pending'),
    (3, 'Round 3 - All-Rounders', 'pending'),
    (4, 'Round 4 - Wicket-Keepers', 'pending'),
    (5, 'Round 5 - Special', 'pending'),
    (6, 'Round 6 - Final', 'pending');

-- Insert default authorized admins (CT and PS owners)
INSERT OR IGNORE INTO authorized_admins (discord_id, name, role) VALUES 
    ('256972361918578688', 'CT Owner', 'super_admin'),
    ('1111497896018313268', 'PS Owner', 'super_admin');

-- Initialize auction state if not exists
INSERT INTO auction_state (status, remaining_time, updated_at) 
SELECT 'idle', 10, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM auction_state);
