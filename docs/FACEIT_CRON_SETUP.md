# FaceIt Cron Job Setup

This guide explains how to set up automated FaceIt synchronization using Vercel Cron Jobs.

## Overview

Two cron jobs work together to keep FaceIt data fresh:

1. **Smart Sync** (every 3 hours) - Efficient, only syncs teams with recently completed matches
2. **Full Sync** (daily at 3 AM) - Comprehensive sync to catch reschedules and new matches

## How It Works

### Smart Sync (Every 3 Hours)
**Schedule:** 12 AM, 3 AM, 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM EST

**Process:**
1. Finds all "scheduled" matches that are 2+ hours old
2. Marks them as "complete" in the database
3. If any matches were completed → Syncs ONLY those teams from FaceIt API
4. If no matches completed → Does nothing (0 API calls)

**Typical API Usage:**
- Non-match days: 0 API calls
- Match days: 2-4 API calls per sync (only teams with completed matches)

### Full Sync (Daily at 3 AM EST)
**Schedule:** Once per day at 3:00 AM EST

**Process:**
1. Syncs ALL FaceIt-enabled teams (currently ~14 teams)
2. Updates standings, scores, creates new matches
3. Catches any rescheduled matches or manual changes

**API Usage:** 14 API calls once per day

## Setup Instructions

### 1. Add Environment Variable

In your Vercel project settings, add:

```
CRON_SECRET=your-secure-random-string-here
```

**Generate a secure secret:**
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32
```

⚠️ **Important:** Keep this secret secure. Anyone with this secret can trigger your cron jobs.

### 2. Create vercel.json

Create a `vercel.json` file in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/smart-sync",
      "schedule": "0 0,3,6,9,12,15,18,21 * * *"
    },
    {
      "path": "/api/cron/full-sync",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Schedule Format:** `minute hour day month dayOfWeek`
- Smart Sync: `0 0,3,6,9,12,15,18,21 * * *` = Every 3 hours on the hour
- Full Sync: `0 3 * * *` = Daily at 3:00 AM

**Timezone:** All times are in UTC. Adjust for your timezone:
- EST = UTC-5, so 3 AM EST = 8 AM UTC → `0 8 * * *`
- PST = UTC-8, so 3 AM PST = 11 AM UTC → `0 11 * * *`

### 3. Deploy

```bash
git add vercel.json
git commit -m "Add FaceIt cron jobs"
git push
```

Vercel will automatically detect and enable the cron jobs on deployment.

### 4. Verify Setup

After deployment, check in Vercel Dashboard:
1. Go to your project → Settings → Cron Jobs
2. You should see both jobs listed with their schedules
3. Check logs in Vercel Dashboard → Deployments → Functions

## Testing Locally

You can test the cron endpoints locally:

```bash
# Test smart sync
curl -X POST http://localhost:3000/api/cron/smart-sync \
  -H "x-cron-secret: your-secret-here"

# Test full sync
curl -X POST http://localhost:3000/api/cron/full-sync \
  -H "x-cron-secret: your-secret-here"
```

## Monitoring

### Check Cron Execution Logs

In Vercel Dashboard:
1. Go to your project
2. Click "Logs" or "Functions"
3. Filter by function name: `api/cron/smart-sync` or `api/cron/full-sync`

### Expected Log Output

**Smart Sync (when matches are found):**
```
[Smart Sync] Starting smart sync cron job...
[Smart Sync] Found 3 old scheduled matches
[Smart Sync] Marked match 123 (ELMT Dark vs FT - Hoshi) as complete
[Smart Sync] 2 unique teams need syncing
[Smart Sync] Syncing team: ELMT Dark
[Smart Sync] Completed: { matchesCompleted: 3, teamsToSync: 2, apiCalls: 2, ... }
```

**Smart Sync (when no matches):**
```
[Smart Sync] Starting smart sync cron job...
[Smart Sync] Found 0 old scheduled matches
[Smart Sync] No old matches found. Skipping sync.
```

**Full Sync:**
```
[Full Sync] Starting full sync cron job...
[Full Sync] Found 14 FaceIt-enabled teams to sync
[Full Sync] Syncing team: ELMT Dark
[Full Sync] Syncing team: ELMT Fire
...
[Full Sync] Completed: { teamsTotal: 14, apiCalls: 14, ... }
```

## Troubleshooting

### Cron Job Not Running

1. **Check Vercel Dashboard:** Settings → Cron Jobs should show your jobs
2. **Verify vercel.json is in project root** (not in a subdirectory)
3. **Ensure production deployment** (crons only work in production)
4. **Check schedule syntax** using [crontab.guru](https://crontab.guru/)

### 401 Unauthorized Error

- Verify `CRON_SECRET` environment variable is set in Vercel
- Ensure the secret matches between Vercel settings and your test requests
- Check that the header name is `x-cron-secret` (lowercase)

### No Teams Being Synced

Check that teams have:
- ✅ FaceIt Enabled checkbox is checked
- ✅ Current FaceIt League is set
- ✅ FaceIt Team ID is populated

### Rate Limiting Issues

The cron jobs include 1-second delays between API calls to avoid rate limiting.
If you still hit rate limits:
- Reduce frequency of smart sync (e.g., every 4 hours instead of 3)
- Check FaceIt API rate limits in their documentation

## Manual Trigger

You can manually trigger a sync at any time:

### Via API (requires cron secret)
```bash
curl -X POST https://your-domain.com/api/cron/smart-sync \
  -H "x-cron-secret: your-secret-here"
```

### Via Bulk Sync Button
In the admin panel:
- Go to People → FaceIt Leagues
- Click "Sync All Active Leagues" button
- This bypasses cron and syncs immediately

## Schedule Recommendations

### Current Schedule (Recommended)
- **Smart Sync:** Every 3 hours (8x/day)
- **Full Sync:** Daily at 3 AM EST

### Adjusting Schedule

**For faster updates (more API calls):**
```json
{
  "path": "/api/cron/smart-sync",
  "schedule": "0 */2 * * *"  // Every 2 hours
}
```

**For less frequent updates (fewer API calls):**
```json
{
  "path": "/api/cron/smart-sync",
  "schedule": "0 */4 * * *"  // Every 4 hours
}
```

**For different daily sync time:**
```json
{
  "path": "/api/cron/full-sync",
  "schedule": "0 10 * * *"  // 10 AM UTC = 5 AM EST
}
```

## API Usage Estimate

With current schedule and ~14 teams:

**Typical Day (with matches):**
- Smart Sync: 2-3 syncs trigger (6-9 API calls)
- Full Sync: 1 sync (14 API calls)
- **Total: ~20-25 API calls/day**

**Off-Day (no matches):**
- Smart Sync: 0 API calls
- Full Sync: 1 sync (14 API calls)
- **Total: ~14 API calls/day**

**Maximum Possible:**
- Smart Sync: 8 syncs × 14 teams = 112 calls (if every sync triggers)
- Full Sync: 1 sync × 14 teams = 14 calls
- **Total: ~126 API calls/day** (extremely unlikely)

FaceIt's rate limits should easily accommodate this usage.

## Related Documentation

- [FaceIt Season Transition Guide](./FACEIT_SEASON_TRANSITION_GUIDE.md)
- [FaceIt API Complete Reference](./FACEIT_API_COMPLETE_REFERENCE.md)
- [FaceIt Go Live Checklist](./FACEIT_GO_LIVE_CHECKLIST.md)

