# Archived API Routes

**Date Archived:** December 21, 2025  
**Reason:** Cleanup of debug and one-time migration routes

---

## ⚠️ Important

These routes are **archived** and **not accessible** via HTTP requests.  
They are kept for reference and potential future use only.

The `_archived` directory is ignored by Next.js routing, so these endpoints cannot be called.

---

## 📁 Directory Structure

### `/debug/` - Development Debug Routes
Routes used during development for debugging specific issues.

- `debug-dragon/` - Debug Dragon team specifically
- `debug-team-fetch/` - Debug team fetching logic
- `debug-team-logos/` - Debug team logo display
- `debug-teams/` - Debug all teams data
- `debug-people-query/` - Debug people queries
- `check-person/` - Inspect individual person records

**Status:** No longer needed, issues resolved

---

### `/migrations/` - One-Time Data Migrations
Routes used for one-time data migrations and fixes.

- `migrate-to-people/` - Migrate name strings to People relationships
- `fix-data-issues/` - General data cleanup
- `fix-match-titles/` - Fix match title formatting
- `fix-person-names/` - Fix person name formatting
- `fix-staff-relationships/` - Link staff to People records

**Status:** Migrations completed successfully

---

## 🔄 If You Need to Restore a Route

1. Move the route directory back to `src/app/api/`
2. Next.js will automatically detect and serve it
3. Remember to remove it again when done

Example:
```bash
# Restore a route
mv src/app/api/_archived/debug/debug-teams src/app/api/

# Use it...

# Archive it again
mv src/app/api/debug-teams src/app/api/_archived/debug/
```

---

## 🗑️ Permanent Deletion

After 2-4 weeks of stable operation without needing these routes:
- Consider permanently deleting this directory
- Keep git history for reference if needed later

---

## ✅ Active Production Routes

The following routes remain active in `src/app/api/`:
- `check-data-consistency/` - Data integrity validation
- `check-people-names/` - Check for missing names
- `seed-teams/` - Database seeding (admin only)
- `create-admin/` - Admin user creation
- `admin-login/` - Admin authentication

