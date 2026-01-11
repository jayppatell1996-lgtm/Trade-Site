# 🏏 Wispbyte League - Live Scoring System Testing Guide

## Overview
This document provides step-by-step testing instructions for the new **Live Scoring System** (Phase 1 & 2).

### New Features Added:
1. **Live Ball-by-Ball Scoring Interface** (`/scoring`)
2. **Public Scorecard Display** (`/scorecard/[matchId]`)
3. **Player Statistics & Leaderboards** (`/stats`)
4. **Automatic Stats Aggregation** (batting averages, bowling economy, etc.)
5. **Tournament Leaderboards** (Orange Cap, Purple Cap)

---

## Pre-Testing Setup

### Step 1: Deploy to Vercel
1. Push code to GitHub
2. Vercel will auto-deploy
3. After deployment, run database migration:
```bash
npm run db:push
```

### Step 2: Verify Database Tables Created
The following new tables should be created:
- `innings`
- `deliveries`
- `batting_performances`
- `bowling_performances`
- `fielding_performances`
- `fall_of_wickets`
- `partnerships`
- `player_stats`
- `match_commentary`

### Step 3: Ensure Test Data Exists
Before testing, make sure you have:
- ✅ At least 2 teams with players
- ✅ At least 1 tournament created
- ✅ At least 1 fixture (match) in "upcoming" status

---

## Test Case 1: Access Control

### 1.1 Non-Admin Cannot Access Scoring Page
**Steps:**
1. Log out or use a non-admin Discord account
2. Navigate to `/scoring`

**Expected Result:**
- Redirected to home page
- No access to scoring interface

### 1.2 Admin Can Access Scoring Page
**Steps:**
1. Log in with admin Discord account (ID: 256972361918578688 or 1111497896018313268)
2. Navigate to `/scoring`

**Expected Result:**
- Scoring page loads
- "Select Match to Score" section visible
- Upcoming matches listed

---

## Test Case 2: Starting a Match

### 2.1 Select Match for Scoring
**Steps:**
1. Go to `/scoring` (as admin)
2. Click on an "Upcoming" match

**Expected Result:**
- Match selected
- Toss selection screen appears
- Both team names displayed

### 2.2 Record Toss
**Steps:**
1. Click on the team that won the toss
2. Select "Bat" or "Bowl"
3. Click "Start Match"

**Expected Result:**
- Success message "Match started!"
- Moves to "Select Opening Batsmen" screen
- Match status changes to "live" in database

### 2.3 Set Opening Batsmen
**Steps:**
1. Select Striker from dropdown (shows batting team players)
2. Select Non-Striker from dropdown
3. Click "Confirm Openers"

**Expected Result:**
- Both batsmen shown cannot be the same
- Moves to "Select Bowler" screen
- Batsmen cards appear (showing 0 runs, 0 balls)

### 2.4 Set Opening Bowler
**Steps:**
1. Select bowler from dropdown (shows bowling team players)
2. Click "Start Over"

**Expected Result:**
- Scoring interface appears
- Current score shows 0/0
- Bowler card shows 0-0 (0)
- "This Over" shows 6 empty circles

---

## Test Case 3: Ball-by-Ball Scoring

### 3.1 Record a Dot Ball
**Steps:**
1. Keep runs at 0
2. Ensure "Extras" is "None"
3. Ensure "Wicket" is not selected
4. Click "Record Ball"

**Expected Result:**
- Score remains 0/0
- Striker's balls increase by 1
- Bowler's dots increase
- "This Over" shows gray "0"
- Current ball increments (0.1 → 0.2)

### 3.2 Record 1 Run
**Steps:**
1. Click "1" in runs section
2. Click "Record Ball"

**Expected Result:**
- Score changes to 1/0
- Striker's runs = 1, balls = 1
- Strike rotates (batsmen swap positions)
- Run rate updates

### 3.3 Record a Four
**Steps:**
1. Click "4" in runs section
2. Click "Record Ball"

**Expected Result:**
- Score increases by 4
- Striker's fours increment
- "This Over" shows blue "4"
- No strike change (4 is even)

### 3.4 Record a Six
**Steps:**
1. Click "6" in runs section
2. Click "Record Ball"

**Expected Result:**
- Score increases by 6
- Striker's sixes increment
- "This Over" shows purple "6"
- No strike change

### 3.5 Record a Wide
**Steps:**
1. Set runs to 0
2. Click "Wide" in extras
3. Set extra runs to 1 (or more for wide + runs)
4. Click "Record Ball"

**Expected Result:**
- Score increases by extra runs
- Ball number does NOT increment (still same ball)
- Bowler's wides increment
- "This Over" shows "1W" or similar

### 3.6 Record a No Ball
**Steps:**
1. Set runs (batsman can score off no ball)
2. Click "Noball" in extras
3. Click "Record Ball"

**Expected Result:**
- Score increases by runs + 1 (no ball)
- Ball number does NOT increment
- Bowler's no-balls increment

### 3.7 Record Byes/Leg Byes
**Steps:**
1. Set runs to 0
2. Click "Bye" or "Legbye"
3. Set extra runs
4. Click "Record Ball"

**Expected Result:**
- Score increases
- Batsman's runs do NOT increase
- Ball increments (byes are legal deliveries)
- Strike changes if odd runs

---

## Test Case 4: Recording Wickets

### 4.1 Bowled Dismissal
**Steps:**
1. Click "Wicket?" button (turns red)
2. Select "Bowled" from dismissal type
3. Click "Record Ball"

**Expected Result:**
- Score shows X/1 (wicket increments)
- "This Over" shows red "W"
- "Select New Batsman" screen appears
- Fall of wickets recorded

### 4.2 Caught Dismissal
**Steps:**
1. Enable wicket
2. Select "Caught"
3. Select fielder from dropdown
4. Click "Record Ball"

**Expected Result:**
- Wicket recorded
- Fielder gets catch credit
- Bowler gets wicket (not run out)

### 4.3 Run Out (Non-Striker)
**Steps:**
1. Set some runs (e.g., 1 or 2)
2. Enable wicket
3. Select "Run Out"
4. Choose "Non-Striker" as dismissed batsman
5. Select fielder
6. Click "Record Ball"

**Expected Result:**
- Runs credited to striker
- Non-striker is out
- Bowler does NOT get wicket credit
- New batsman selection for non-striker position

### 4.4 Add New Batsman After Wicket
**Steps:**
1. After wicket, select new batsman from dropdown
2. Click "Send to Crease"

**Expected Result:**
- New batsman appears in correct position
- New partnership starts
- Scoring interface returns

### 4.5 All Out (10 wickets)
**Steps:**
1. Record 10 wickets

**Expected Result:**
- "End Innings" screen automatically appears
- Cannot add more batsmen

---

## Test Case 5: Over Completion

### 5.1 Complete an Over
**Steps:**
1. Record 6 legal deliveries

**Expected Result:**
- Over counter increments (0 → 1)
- Ball resets to 1
- "This Over" clears (empty circles)
- Strike automatically changes
- "Select Bowler" screen appears
- Previous bowler cannot bowl consecutive over

### 5.2 New Bowler Selection
**Steps:**
1. Select different bowler
2. Click "Start Over"

**Expected Result:**
- New bowler's stats shown
- Scoring continues

---

## Test Case 6: End of Innings

### 6.1 End First Innings Manually
**Steps:**
1. Click "End Innings" button
2. Confirm

**Expected Result:**
- First innings score saved
- "Select Opening Batsmen" for second team
- Target displayed (first innings + 1)
- Score display shows "Target: X"

### 6.2 Complete Second Innings
**Steps:**
1. Score second innings
2. Either:
   - Chase down target (batting team wins)
   - All out (bowling team wins)
   - Or click "End Innings" manually

**Expected Result:**
- "End Match" screen appears
- Select winner
- Enter result text
- Optional: Select Player of Match

---

## Test Case 7: End Match

### 7.1 Complete Match
**Steps:**
1. On "End Match" screen, select winner
2. Enter result (e.g., "CT won by 5 wickets")
3. Optionally select Player of Match
4. Click "Complete Match"

**Expected Result:**
- Success message
- Redirected to scorecard page
- Match status = "completed"
- Group standings updated (if tournament match)
- Player stats updated

---

## Test Case 8: Public Scorecard (`/scorecard/[matchId]`)

### 8.1 View Live Scorecard
**Steps:**
1. During live match, navigate to `/scorecard/[matchId]`

**Expected Result:**
- Live score displayed
- Auto-refreshes every 10 seconds
- "LIVE" badge shown
- Current batsmen and bowler stats visible

### 8.2 View Completed Scorecard
**Steps:**
1. Navigate to scorecard of completed match

**Expected Result:**
- Full batting card (all batsmen, how out, runs, balls, 4s, 6s, SR)
- Full bowling card (overs, maidens, runs, wickets, economy)
- Fall of wickets
- Partnerships
- Match result
- Extras breakdown

### 8.3 Scorecard Access for Non-Users
**Steps:**
1. Log out
2. Navigate to `/scorecard/[matchId]`

**Expected Result:**
- Scorecard viewable without login (public page)

---

## Test Case 9: Player Statistics (`/stats`)

### 9.1 View Tournament Leaderboard
**Steps:**
1. Navigate to `/stats`
2. Select a tournament from dropdown

**Expected Result:**
- Orange Cap (Most Runs) shows top 10
- Purple Cap (Most Wickets) shows top 10
- Most Sixes/Fours leaders
- Best Batting/Bowling Averages

### 9.2 View Team Stats
**Steps:**
1. Click "Team Stats" tab
2. Select a team

**Expected Result:**
- All team players listed
- Columns: M (matches), Runs, Avg, Wkts, Econ
- Click player to view profile

### 9.3 View Player Profile
**Steps:**
1. Click on any player name

**Expected Result:**
- Player profile page loads
- Career stats displayed:
  - Batting: Matches, Runs, Average, SR, 50s, 100s, HS
  - Bowling: Wickets, Average, Economy, Best, 3W, 5W
  - Fielding: Catches, Run Outs, Stumpings
- Recent form (last 5 matches)

### 9.4 Leaderboard Minimum Requirements
**Steps:**
1. Check "Best Batting Average" section

**Expected Result:**
- Shows "Min 3 innings required" if no qualifying players
- Only shows players with 3+ innings

**Steps:**
1. Check "Best Bowling Average" section

**Expected Result:**
- Shows "Min 5 wickets required" if no qualifying players
- Only shows players with 5+ wickets

---

## Test Case 10: Navigation Updates

### 10.1 Stats Link Visible to All
**Steps:**
1. Log in as any user (or stay logged out)
2. Check navigation bar

**Expected Result:**
- "Stats" link visible in nav
- Clicking navigates to `/stats`

### 10.2 Scoring Link Only for Admins
**Steps:**
1. Log in as non-admin

**Expected Result:**
- "Live Scoring 🔒" NOT visible in nav

**Steps:**
1. Log in as admin

**Expected Result:**
- "Live Scoring 🔒" visible with lock icon
- Clicking navigates to `/scoring`

---

## Test Case 11: Resume Live Match

### 11.1 Resume Scoring a Live Match
**Steps:**
1. Start a match, score a few overs
2. Close browser/tab
3. Return to `/scoring`

**Expected Result:**
- Live match appears under "🔴 Live Matches (Resume Scoring)"
- Clicking it loads current state
- Correct batsmen, bowler, score displayed
- Can continue scoring

---

## Test Case 12: Edge Cases

### 12.1 Swap Strike Button
**Steps:**
1. In scoring interface, click "🔄 Swap Strike"

**Expected Result:**
- Batsmen positions swap
- Strike indicator (*) moves

### 12.2 Super Over / Tie (Manual)
**Steps:**
1. Second innings ends with scores tied

**Expected Result:**
- Can select "Tie" or manually handle super over
- Result text can indicate tie

### 12.3 Match Without Tournament
**Steps:**
1. Create a standalone match (not in tournament)
2. Complete the match

**Expected Result:**
- Player stats still update
- No group standings affected

---

## Test Case 13: Data Integrity

### 13.1 Verify Batting Stats
**Steps:**
1. Complete a match where a batsman scores 50 runs, 45 balls, 6 fours, 2 sixes
2. Check player stats page

**Expected Result:**
- Runs += 50
- Balls += 45
- Fours += 6
- Sixes += 2
- 50s += 1
- Average recalculated

### 13.2 Verify Bowling Stats
**Steps:**
1. Bowler takes 3-25 in 4 overs
2. Check player stats page

**Expected Result:**
- Wickets += 3
- Runs conceded += 25
- Overs += 4
- Economy = 25/4 = 6.25
- 3W hauls += 1

### 13.3 Verify Fielding Stats
**Steps:**
1. Player takes 2 catches in a match
2. Check player stats page

**Expected Result:**
- Catches += 2

---

## Quick Reference: API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scoring?type=matches-for-scoring` | GET | List matches available to score |
| `/api/scoring?type=live&matchId=X` | GET | Get live match state |
| `/api/scoring?type=scorecard&matchId=X` | GET | Get full scorecard |
| `/api/scoring?type=leaderboard&tournamentId=X` | GET | Get tournament leaderboard |
| `/api/scoring?type=player-stats&playerId=X` | GET | Get player statistics |
| `/api/scoring?type=team-stats&teamId=X` | GET | Get team players with stats |
| `/api/scoring` | POST | Actions: start_match, set_openers, set_bowler, record_delivery, add_batsman, end_innings, end_match |

---

## Troubleshooting

### Issue: "Failed to record delivery"
**Solution:** Check browser console for errors. Ensure all required fields are selected (batsman, bowler, etc.)

### Issue: Stats not updating after match
**Solution:** `updatePlayerStats()` runs on match completion. Check if match status changed to "completed"

### Issue: Leaderboard empty
**Solution:** Need completed matches with valid performances. Check `player_stats` table has data.

### Issue: Wrong batsman on strike after over
**Solution:** Strike auto-swaps at end of over. Use "Swap Strike" if incorrect.

---

## Success Criteria

✅ Admin can start, score, and complete a match  
✅ All delivery types work (runs, extras, wickets)  
✅ Scorecard displays correctly during and after match  
✅ Player stats aggregate properly  
✅ Leaderboards show correct rankings  
✅ Non-admins can view stats and scorecards but not score  
✅ Live match can be resumed after page refresh  
