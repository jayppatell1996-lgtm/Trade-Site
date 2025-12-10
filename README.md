# Auction Timer Fixes

## Issues Fixed

### 1. Timer Showing Huge Number (1765353084s)
**Problem:** Timer was displaying raw Unix timestamp instead of remaining seconds.

**Solution:** Fixed `state/route.ts` to properly calculate remaining time:
- When active: `remainingTime = (timerEndTime - Date.now()) / 1000`
- When paused: `timerEndTime` stores remaining milliseconds directly
- Added validation to ensure timer is always a valid, reasonable number
- Capped maximum at 12 seconds

### 2. `e.toFixed is not a function` Error
**Problem:** Timer value was not a valid number, causing crash.

**Solution:** Added defensive checks in both API and frontend:
- `Number.isFinite()` validation
- Fallback to 0 for invalid values
- `Math.max(0, ...)` to prevent negative values

### 3. Resume Now Resets Timer
**Changed Behavior:** Resume button now resets timer to 12 seconds (instead of preserving remaining time).

### 4. Timer Constants Updated
- **Initial timer:** 12 seconds (was 10)
- **After bid:** 8 seconds (was 6)

### 5. Smoother Progress Bar
- Timer decrements by 0.1 seconds (100ms intervals) for smooth animation
- CSS transition: `duration-100 ease-linear`
- Local timer state separate from server sync (syncs every 1.5s)

### 6. Last-Second Bidding Allowed
- Added 500ms grace period for bids
- Bids accepted if auction is active, even at 0 seconds
- Only rejects if time has been expired for > 500ms

### 7. Player ID Tracking
When players are sold, they're now added to teams with their original `playerId`:
```javascript
{
  id: originalPlayerId,       // From auction round import
  auctionPlayerId: auctionId, // Internal auction tracking ID  
  name: "Player Name",
  category: "Batsman",
  purchasePrice: 1000000,
  purchasedAt: "2024-...",
  roundId: 1
}
```

### 8. Auction Round List
Added "📋 Change Round" button to view and select different auction rounds.

## Files Changed

```
src/
├── app/
│   ├── auction/
│   │   └── page.tsx              # Complete rewrite with all fixes
│   └── api/
│       └── auction/
│           ├── state/route.ts    # Fixed timer calculation
│           ├── control/route.ts  # Resume resets timer
│           ├── bid/route.ts      # 8s reset, last-second bids
│           ├── sold/route.ts     # Includes player ID
│           └── rounds/
│               ├── route.ts      # List, create, delete rounds
│               └── [roundId]/
│                   └── players/route.ts
└── lib/
    └── db/
        └── schema.ts             # Added playerId to auction_players

migrations/
└── add_player_id.sql            # Migration to add player_id column
```

## Migration Required

Run this SQL to add the `player_id` column (if it doesn't exist):
```sql
ALTER TABLE auction_players ADD COLUMN player_id INTEGER;
```

## Timer Flow

1. **Start Auction:** Timer set to 12 seconds
2. **Bid Placed:** Timer resets to 8 seconds
3. **Pause:** Remaining time stored (in milliseconds)
4. **Resume:** Timer resets to 12 seconds (full reset)
5. **Timer reaches 0:** 500ms grace period for final bids, then auto-sell/unsold

## API Changes

### POST /api/auction/bid
- Returns `{ remainingTime: 8 }` on successful bid
- Returns `{ retry: true }` on 429 (server busy)
- 500ms grace period for last-second bids

### POST /api/auction/control
Actions: `start`, `pause`, `resume`, `skip`, `stop`
- `resume` now resets timer to 12s

### POST /api/auction/sold
- Now includes `playerId` in response
- Adds player to team with full tracking data

### GET /api/auction/state
- `remainingTime` always returns valid number 0-12
- Proper handling of paused vs active states
