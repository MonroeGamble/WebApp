# 🏈 Live Football Scores & Community Predictions

A real-time football scores page featuring NFL and College Football games with community voting/prediction functionality.

## Features

### 📊 Live Scores
- Real-time NFL and NCAA football scores
- Game status tracking (Scheduled, Live, Final)
- Quarter-by-quarter updates with game clock
- Team logos and branding
- Auto-refresh every 60 seconds during game days

### 🗳️ Community Predictions
- Vote for the team you think will win
- Real-time vote percentage visualization
- Aggregate community predictions per game
- Instant vote updates via Supabase realtime

### 📱 User Experience
- Mobile-responsive design
- Filter by league (All, NFL, NCAA)
- View toggle (Schedule vs Live games only)
- Clean, modern UI matching existing site style
- Grouped by date with live game indicators

## Architecture

### Data Flow

```
ESPN API (Free)
     ↓
GitHub Action (Scheduled)
     ↓
data/football/current-week.json
     ↓
Frontend (Auto-refresh)
     ↓
User sees live scores
```

### Components

1. **HTML** (`football-live.html`)
   - Semantic structure
   - Accessibility features
   - Modal for voting

2. **CSS** (`football-live.css`)
   - Responsive grid layout
   - Game card styling
   - Vote visualization
   - Mobile-first design

3. **JavaScript** (`football-live.js`)
   - Data fetching and caching
   - Dynamic rendering
   - Auto-refresh logic
   - Voting integration

4. **GitHub Action** (`.github/workflows/update-football-scores.yml`)
   - Runs every 5 minutes on game days (Fri-Mon)
   - Fetches from ESPN API (free, no key needed)
   - Commits updated JSON to repository

5. **Data Fetcher** (`scripts/fetch_football_scores.js`)
   - Node.js script
   - Fetches NFL + NCAA scores from ESPN
   - Normalizes data format
   - Writes to JSON file

## Setup Instructions

### 1. Basic Setup (No voting)

The page works immediately with static data:

```bash
# Just open the page
open FootballLive/football-live.html
```

### 2. Enable Live Data Updates

The GitHub Action fetches live scores automatically. No API key needed since we use ESPN's free public API.

**To test manually:**
```bash
cd scripts
npm install node-fetch
node fetch_football_scores.js
```

### 3. Enable Voting (Optional - Supabase)

To enable community voting, set up Supabase:

**A. Create Supabase Project**
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project

**B. Create Database Tables**

Run this SQL in your Supabase SQL Editor:

```sql
-- Games table (optional, for reference)
CREATE TABLE football_games (
  id TEXT PRIMARY KEY,
  league TEXT NOT NULL,
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE football_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  team_pick TEXT NOT NULL CHECK (team_pick IN ('home', 'away')),
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_ip TEXT,  -- Optional: track unique voters
  UNIQUE(game_id, user_ip)  -- One vote per IP per game
);

-- Index for faster queries
CREATE INDEX idx_votes_game ON football_votes(game_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE football_votes;
```

**C. Configure Frontend**

Add Supabase JS library to `football-live.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Update `football-live.js` configuration:

```javascript
const CONFIG = {
    dataUrl: '../data/football/current-week.json',
    refreshInterval: 60000,
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseKey: 'your-anon-public-key'
};
```

**D. Optional: Rate Limiting**

Add RLS (Row Level Security) policies in Supabase:

```sql
-- Allow anyone to read votes
CREATE POLICY "Anyone can read votes"
  ON football_votes FOR SELECT
  USING (true);

-- Allow inserts but with rate limiting via user_ip
CREATE POLICY "Limit votes per IP"
  ON football_votes FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM football_votes
      WHERE game_id = football_votes.game_id
      AND user_ip = football_votes.user_ip
    )
  );
```

## Data Format

### Game Object Structure

```typescript
{
  "id": "nfl-2024-w13-chiefs-bills",
  "league": "NFL" | "NCAA",
  "season": 2024,
  "week": 13,
  "startTime": "2024-11-24T13:00:00-05:00",
  "homeTeam": {
    "id": "buf",
    "name": "Buffalo Bills",
    "shortName": "Bills",
    "abbreviation": "BUF",
    "logoUrl": "https://..."
  },
  "awayTeam": {
    "id": "kc",
    "name": "Kansas City Chiefs",
    "shortName": "Chiefs",
    "abbreviation": "KC",
    "logoUrl": "https://..."
  },
  "status": "scheduled" | "in_progress" | "final",
  "homeScore": 24,
  "awayScore": 21,
  "quarter": 4,
  "clock": "2:35",
  "possession": "home" | "away" | null
}
```

## Customization

### Change Refresh Interval

Edit `CONFIG.refreshInterval` in `football-live.js`:

```javascript
const CONFIG = {
    refreshInterval: 30000,  // 30 seconds (faster)
    // or
    refreshInterval: 120000, // 2 minutes (slower)
};
```

### Modify GitHub Action Schedule

Edit `.github/workflows/update-football-scores.yml`:

```yaml
schedule:
  # Run every 2 minutes on game days
  - cron: '*/2 * * * 5-1'
```

### Customize Styling

Edit `football-live.css` - all colors and dimensions are customizable:

```css
/* Change primary color */
.filter-btn.active {
    background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

## Performance

### Optimizations Built-in

1. **Minimal API Calls**
   - GitHub Action fetches data (not frontend)
   - Frontend only reads static JSON files
   - No direct browser → ESPN API calls

2. **Smart Refresh**
   - Only runs frequently on game days (Fri-Mon)
   - 60-second auto-refresh (configurable)
   - Stops refreshing when tab inactive

3. **Efficient Rendering**
   - Virtual DOM not needed (vanilla JS)
   - Direct DOM updates for votes
   - CSS animations (GPU accelerated)

4. **Lightweight**
   - No React, Vue, or heavy frameworks
   - ~50KB total (HTML + CSS + JS)
   - Optional Supabase client (~100KB)

### Estimated Costs

- **ESPN API**: Free (public endpoint, no key required)
- **GitHub Actions**: Free tier includes 2,000 minutes/month
- **Supabase**: Free tier includes 500MB database, 2GB bandwidth
- **GitHub Pages**: Free for public repos

**Total monthly cost**: $0 🎉

## Troubleshooting

### Votes Not Saving

1. Check browser console for Supabase errors
2. Verify Supabase URL and key are correct
3. Check RLS policies allow inserts
4. Ensure `football_votes` table exists

### Scores Not Updating

1. Check GitHub Action ran successfully
2. Verify `data/football/current-week.json` was updated
3. Check browser network tab for fetch errors
4. Clear browser cache

### Games Not Showing

1. Check `current-week.json` has valid data
2. Verify file path in `CONFIG.dataUrl`
3. Check browser console for JavaScript errors
4. Ensure JSON is valid (use JSONLint)

## Future Enhancements

Potential additions:

- [ ] User authentication (track predictions per user)
- [ ] Leaderboards (most accurate predictors)
- [ ] Push notifications for game updates
- [ ] Historical prediction accuracy stats
- [ ] Point spread and over/under predictions
- [ ] Live chat/comments per game
- [ ] Playoff bracket predictions
- [ ] Fantasy football integration

## License

Part of FranResearch project. All rights reserved.

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review existing GitHub Issues
- Create a new Issue with detailed description

---

Built with ❤️ using vanilla JavaScript, ESPN API, and Supabase
