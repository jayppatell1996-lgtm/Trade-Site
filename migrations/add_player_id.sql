-- Migration: Add player_id column to auction_players
-- This allows tracking the original player ID from imported data

-- Check if column exists and add if not
-- SQLite doesn't support IF NOT EXISTS for columns, so this may error if column exists
-- Run this in a try-catch in your migration script

ALTER TABLE auction_players ADD COLUMN player_id INTEGER;
