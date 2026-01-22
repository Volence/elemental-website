# User Delete Fix - January 2026

## Problem

**"Something went wrong"** error when trying to delete a user from the admin panel.

### Root Cause

Foreign key constraints on `audit_logs`, `error_logs`, and `active_sessions` tables don't have `ON DELETE` behavior, so they default to `RESTRICT`. This means:

- If a user has any audit logs (login/logout events) → Can't delete ❌
- If a user has any error logs → Can't delete ❌  
- If a user has any active/past sessions → Can't delete ❌

Since every user who logs in creates audit logs and sessions, **no user can be deleted**.

## Solution

A database migration that updates the foreign key constraints to `ON DELETE SET NULL`:

- ✅ When a user is deleted, their audit logs remain but `user_id` becomes `NULL`
- ✅ When a user is deleted, their error logs remain but `user_id` becomes `NULL`
- ✅ When a user is deleted, their sessions remain but `user_id` becomes `NULL`

This preserves the logs for compliance/debugging while allowing user deletion.

## Files Created

- `src/migrations/20260104_fix_user_delete_constraints.ts` - The migration

## How to Apply (When Ready)

**Option 1: Let Payload auto-migrate on next deployment** (Recommended)
```bash
# The migration will run automatically on next deploy
./scripts/deploy-to-server.sh
```

**Option 2: Run migration manually via SSH**
```bash
# SSH to production
ssh -i ~/.ssh/id_rsa ubuntu@129.213.21.96

# Navigate to project
cd /home/ubuntu/elemental-website

# Run migration directly via PostgreSQL
docker compose exec postgres psql -U payload -d payload << 'EOSQL'
-- Fix audit_logs foreign key
ALTER TABLE "audit_logs" 
  DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") 
  REFERENCES "users"("id") 
  ON DELETE SET NULL;

-- Fix error_logs foreign key
ALTER TABLE "error_logs"
  DROP CONSTRAINT IF EXISTS "error_logs_user_id_fkey";

ALTER TABLE "error_logs"
  ADD CONSTRAINT "error_logs_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL;

-- Fix active_sessions foreign key
ALTER TABLE "active_sessions"
  DROP CONSTRAINT IF EXISTS "active_sessions_user_id_fkey";

ALTER TABLE "active_sessions"
  ADD CONSTRAINT "active_sessions_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL;
EOSQL

echo "✅ Migration applied! Try deleting the user now."
```

## Testing After Apply

1. Go to https://elmt.gg/admin/collections/users
2. Select a test user (like "Test")
3. Click Delete
4. Should delete successfully ✅

## What's Preserved When Deleting a User

- ✅ All audit logs (with `user_id = NULL`)
- ✅ All error logs (with `user_id = NULL`)
- ✅ All session records (with `user_id = NULL`)
- ❌ The user record itself (deleted)
- ❌ User's auth tokens (deleted)
- ❌ User's preferences (deleted via CASCADE)

## Risk Assessment

**Risk Level**: LOW ⚠️

- The migration only changes foreign key constraints
- No data is deleted or modified
- Existing logs remain intact
- Can be reverted if needed
- Takes < 1 second to apply

**Timing**: Can be applied anytime, even during production use

---

**Created**: January 4, 2026  
**Status**: Ready to apply (waiting for user approval)  
**Urgency**: Medium (blocking user management)

