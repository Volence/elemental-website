# Quick Deploy - Avatar Save Fix

## What Was Wrong

The Users collection was logging **every user update** (including avatar changes) to the audit-logs table. On production, this extra database write was causing the save operation to hang.

## What I Fixed

Modified `src/collections/Users/index.ts` to:
- ✅ Only log user **creation**, not every profile update
- ✅ Added error handling so audit logging never blocks saves
- ✅ Avatar updates now save instantly

## Deploy to Production

```bash
# 1. Deploy the fix
./scripts/deploy-to-server.sh

# 2. Test it works
# - Go to https://elmt.gg/admin/account
# - Select an avatar
# - Click Save
# - Should save in < 2 seconds ✅
```

## Optional: Check Production Logs First

```bash
# See if there are database issues
./scripts/check-production-logs.sh
```

## What's Still Audited

- ✅ User creation
- ✅ User deletion  
- ✅ Login/logout events
- ❌ Avatar/name updates (not important enough to audit)

Full details: `docs/AVATAR_SAVE_FIX.md`

