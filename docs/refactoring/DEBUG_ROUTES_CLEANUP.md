# Debug API Routes - Cleanup Plan

**Date:** December 21, 2025  
**Status:** Ready for Cleanup

---

## 🎯 Overview

During development, we created 17 debug and migration API routes. Now that the system is stable, we should clean these up to reduce the API surface and improve security.

---

## 📋 Debug Routes to Remove (7 routes)

These routes were created for debugging and should be removed in production:

### 1. `/api/debug-dragon`
**Purpose:** Debug Dragon team specifically  
**Status:** ⚠️ Remove  
**Reason:** Team-specific debugging, no longer needed

### 2. `/api/debug-team-fetch`
**Purpose:** Debug team fetching logic  
**Status:** ⚠️ Remove  
**Reason:** General debugging, use admin panel instead

### 3. `/api/debug-team-logos`
**Purpose:** Debug team logo display  
**Status:** ⚠️ Remove  
**Reason:** Logo issues resolved

### 4. `/api/debug-teams`
**Purpose:** Debug all teams data  
**Status:** ⚠️ Remove  
**Reason:** Use admin panel or check-data-consistency instead

### 5. `/api/debug-people-query`
**Purpose:** Debug people queries  
**Status:** ⚠️ Remove  
**Reason:** Use check-people-names instead

### 6. `/api/check-person/[id]`
**Purpose:** Inspect individual person records  
**Status:** ⚠️ Remove  
**Reason:** Use admin panel for individual record inspection

### 7. `/api/check-people-names`
**Purpose:** Check for people with missing names  
**Status:** ✅ Keep (useful for data validation)  
**Reason:** Helps diagnose "Untitled" entries

---

## 🔄 Migration Routes (5 routes)

These were one-time migration scripts. Keep or remove based on need:

### 1. `/api/migrate-to-people`
**Purpose:** Migrate name strings to People relationships  
**Status:** ⚠️ Archive (keep code, disable route)  
**Reason:** One-time migration completed, may need reference

### 2. `/api/fix-data-issues`
**Purpose:** General data cleanup  
**Status:** ⚠️ Remove  
**Reason:** Generic fixer, use specific tools instead

### 3. `/api/fix-match-titles`
**Purpose:** Fix match title formatting  
**Status:** ⚠️ Remove  
**Reason:** One-time fix completed

### 4. `/api/fix-person-names`
**Purpose:** Fix person name formatting  
**Status:** ⚠️ Remove  
**Reason:** One-time fix completed

### 5. `/api/fix-staff-relationships`
**Purpose:** Link staff to People records  
**Status:** ⚠️ Archive (keep code, disable route)  
**Reason:** May need to re-run if data issues occur

---

## ✅ Production Routes to Keep (5 routes)

These are legitimate production endpoints:

### 1. `/api/check-data-consistency`
**Purpose:** Check for data integrity issues  
**Status:** ✅ Keep  
**Reason:** Useful for ongoing data validation

### 2. `/api/seed-teams`
**Purpose:** Seed database with teams data  
**Status:** ✅ Keep (admin only)  
**Reason:** Useful for dev/staging environments

### 3. `/api/create-admin`
**Purpose:** Create admin user  
**Status:** ✅ Keep (secure properly)  
**Reason:** Needed for initial setup

### 4. `/api/admin-login`
**Purpose:** Admin authentication  
**Status:** ✅ Keep  
**Reason:** Core authentication functionality

### 5. `/api/data-consistency-check`
**Purpose:** Alternative data consistency checker  
**Status:** ⚠️ Consolidate with check-data-consistency  
**Reason:** Duplicate functionality

---

## 🗂️ Recommended Actions

### Phase 1: Document and Disable (Safe)
1. Move debug routes to `src/app/api/_archived/` directory
2. Add README explaining why they're archived
3. Routes become inaccessible but code is preserved

### Phase 2: Remove Completely (After Testing)
1. Delete debug route files
2. Delete one-time migration files
3. Update documentation

---

## 📝 Implementation Plan

### Step 1: Create Archive Directory
```bash
mkdir -p src/app/api/_archived/debug
mkdir -p src/app/api/_archived/migrations
```

### Step 2: Move Debug Routes
```bash
# Debug routes
mv src/app/api/debug-dragon src/app/api/_archived/debug/
mv src/app/api/debug-team-fetch src/app/api/_archived/debug/
mv src/app/api/debug-team-logos src/app/api/_archived/debug/
mv src/app/api/debug-teams src/app/api/_archived/debug/
mv src/app/api/debug-people-query src/app/api/_archived/debug/
mv src/app/api/check-person src/app/api/_archived/debug/
```

### Step 3: Move Migration Routes
```bash
# One-time migrations
mv src/app/api/fix-data-issues src/app/api/_archived/migrations/
mv src/app/api/fix-match-titles src/app/api/_archived/migrations/
mv src/app/api/fix-person-names src/app/api/_archived/migrations/
mv src/app/api/migrate-to-people src/app/api/_archived/migrations/
mv src/app/api/fix-staff-relationships src/app/api/_archived/migrations/
```

### Step 4: Create Archive README
```markdown
# Archived API Routes

These routes have been archived and are no longer accessible.
They are kept for reference and potential future use.

## Debug Routes
- Used during development for debugging
- No longer needed in production

## Migration Routes  
- One-time data migrations
- Completed successfully
- Kept for reference if similar migrations needed
```

---

## 🔒 Security Benefits

### Before Cleanup
- **17 API routes** exposed
- **7 debug endpoints** accessible
- **5 migration endpoints** could be accidentally triggered
- Larger attack surface

### After Cleanup
- **5 production routes** only
- **70% reduction** in API surface
- **No accidental migrations**
- Cleaner, more secure API

---

## 📊 Summary

| Category | Count | Action |
|----------|-------|--------|
| Debug Routes | 7 | Archive (6), Keep (1) |
| Migration Routes | 5 | Archive all |
| Production Routes | 5 | Keep all |
| **Total Before** | **17 routes** | - |
| **Total After** | **5 routes** | **70% reduction** |

---

## ✅ Verification Checklist

After cleanup:
- [ ] Only 5 routes in `src/app/api/`
- [ ] All archived routes in `_archived/` directory
- [ ] Archive README created
- [ ] No broken imports
- [ ] Production routes still work
- [ ] Admin panel still functional
- [ ] Data consistency checks still work

---

## 🔄 Rollback Plan

If issues arise:
1. Routes are in `_archived/` directory
2. Simply move them back to `src/app/api/`
3. Next.js will automatically detect and serve them

---

**Recommendation:** Start with archiving (moving to `_archived/`). After 2-4 weeks of stable operation, permanently delete archived routes.

