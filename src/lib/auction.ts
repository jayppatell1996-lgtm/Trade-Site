// ==========================================
// AUCTION CONSTANTS
// Matching the Discord bot configuration
// ==========================================

// Timer settings (in seconds)
export const BID_INCREMENT_TIME = 10;  // Initial timer when auction starts
export const BID_CONTINUE_TIME = 6;    // Timer reset after each bid

// Team settings
export const MAX_TEAM_SIZE = 18;
export const DEFAULT_PURSE = 20000000; // $20 million

// Authorized admin Discord IDs who can control auction
// These users can: Start, Next, Sold, Pause/Resume, Stop
export const AUTHORIZED_ADMIN_IDS = [
  '256972361918578688',   // CT Owner
  '1111497896018313268',  // PS Owner
];

// ==========================================
// BID INCREMENT CALCULATION
// Matching Discord bot logic exactly
// ==========================================
export function calculateBidIncrement(basePrice: number): number {
  if (basePrice >= 2000000) {
    return 1000000;  // $1M increment for $2M+ base
  } else if (basePrice >= 1000000) {
    return 500000;   // $500K increment for $1M+ base
  } else if (basePrice >= 500000) {
    return 250000;   // $250K increment for $500K+ base
  } else {
    return basePrice; // Increment = base price for lower values
  }
}

// ==========================================
// AUTHORIZATION HELPERS
// ==========================================
export function isAuthorizedAdmin(discordId: string | null): boolean {
  if (!discordId) return false;
  return AUTHORIZED_ADMIN_IDS.includes(discordId);
}

// ==========================================
// FORMATTING HELPERS
// ==========================================
export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function formatFullCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ==========================================
// AUCTION STATUS TYPES
// ==========================================
export type AuctionStatus = 'idle' | 'active' | 'paused' | 'stopped';
export type PlayerStatus = 'pending' | 'current' | 'sold' | 'unsold';
export type RoundStatus = 'pending' | 'active' | 'completed';
export type LogType = 'info' | 'sale' | 'unsold' | 'pause' | 'resume' | 'stop' | 'bid' | 'error';

// ==========================================
// PLAYER CATEGORIES
// ==========================================
export const PLAYER_CATEGORIES = [
  'Batsman',
  'Bowler',
  'All-Rounder',
  'Wicket-Keeper',
] as const;

export type PlayerCategory = typeof PLAYER_CATEGORIES[number];
