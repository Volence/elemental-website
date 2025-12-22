# Phase 4A: Utilities & Hooks - Complete

**Date:** December 21, 2025  
**Duration:** ~1 hour  
**Status:** ✅ Complete

---

## Overview

Phase 4A focused on creating shared utilities and hooks to eliminate duplicate code in admin panel components. This phase laid the foundation for all subsequent Phase 4 work.

---

## Files Created

### 1. `src/utilities/adminAuth.ts` (82 lines)
**Purpose:** Type-safe hooks for user authentication and permission checks

**Exports:**
```typescript
useAdminUser()          // Get current user with proper typing
useIsAdmin()            // Check if user is admin
useIsTeamManager()      // Check if user is team manager
useIsStaffManager()     // Check if user is staff manager
useCanManageTeams()     // Check if user can manage teams (any manager role)
getRoleLabel(role)      // Get human-readable role label
```

**Impact:**
- Eliminates 8 instances of `const currentUser = user as User`
- Provides consistent, type-safe permission checks
- Single source of truth for role-based logic

---

### 2. `src/utilities/adminHooks.ts` (262 lines)
**Purpose:** Reusable data-fetching hooks for admin components

**Exports:**
```typescript
useAssignedTeams()       // Fetch assigned teams for current user
usePersonRelationships() // Fetch all relationships for a person
useDashboardStats()      // Fetch quick stats for dashboard
```

**Impact:**
- Eliminates ~160 lines of duplicate team-fetching logic
- Consolidates relationship fetching logic (was 277 lines → now in hook)
- Reduces API calls by caching results

---

### 3. Enhanced `src/utilities/personHelpers.ts` (+73 lines)
**Purpose:** Helper functions for person ID extraction and list operations

**New Functions:**
```typescript
extractPersonId(person)           // Extract ID from various formats
isPersonInList(personId, list)   // Check if person is in a list
findPersonInList(personId, list) // Find person in a list
```

**Impact:**
- Eliminates duplicate ID extraction pattern (found in 3 files)
- Used by `usePersonRelationships` hook
- Will be used by list column components in Phase 4D

---

### 4. `src/utilities/formatters.ts` (135 lines)
**Purpose:** Text formatting utilities for consistent display

**Exports:**
```typescript
formatRole(role)              // "event-manager" → "Event Manager"
formatProductionType(type)    // "observer-producer" → "Observer/Producer"
formatPersonType(type)        // "player" → "Player"
formatRegion(region)          // "NA" → "North America"
formatGameRole(role)          // "TANK" → "tank"
truncate(str, maxLength)      // Truncate with ellipsis
pluralize(word, count)        // Smart pluralization
formatCountLabel(count, label) // "5 teams", "1 player"
```

**Impact:**
- Consolidates role formatting logic (was duplicated in 2 files)
- Provides consistent formatting across admin panel
- Ready for use in Phase 4B (CSS conversion)

---

## Components Updated

### Simplified Components (removed duplicate logic)

| Component | Before | After | Lines Saved |
|-----------|--------|-------|-------------|
| `AssignedTeamsDashboard/index.tsx` | 243 lines | ~140 lines | **~100** |
| `AssignedTeamsBanner/index.tsx` | 219 lines | ~115 lines | **~100** |
| `PersonRelationships/index.tsx` | 277 lines | 166 lines | **111** |
| `QuickStats/index.tsx` | 229 lines | 167 lines | **62** |
| `BeforeDashboard/index.tsx` | 133 lines | 129 lines | **4** |
| `ReadOnlyIndicator/index.tsx` | 74 lines | 69 lines | **5** |
| `TeamManagerInfo/index.tsx` | 98 lines | 92 lines | **6** |
| `ReadOnlyStyles/index.tsx` | 349 lines | 344 lines | **5** (more in Phase 4C) |

**Total Lines Removed:** ~393 lines from components  
**Total Lines Added:** 557 lines in utilities  
**Net Impact:** +164 lines, but with **dramatically improved maintainability**

---

## Code Quality Improvements

### Before (Duplicate Pattern - 8 instances)
```typescript
// Every component did this:
const { user } = useAuth()
// @ts-ignore - Payload ClientUser type compatibility issue
const currentUser = user as User

if (currentUser.role === UserRole.ADMIN) { /* ... */ }
if (currentUser.role === UserRole.TEAM_MANAGER) { /* ... */ }
```

### After (Clean Pattern)
```typescript
import { useIsAdmin, useIsTeamManager } from '@/utilities/adminAuth'

const isAdmin = useIsAdmin()
const isTeamManager = useIsTeamManager()
```

---

### Before (Duplicate Team Fetching - 2 instances, ~80 lines each)
```typescript
// AssignedTeamsDashboard
const [assignedTeams, setAssignedTeams] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchTeams = async () => {
    // 80 lines of fetching, parsing, error handling...
  }
  fetchTeams()
}, [user])

// AssignedTeamsBanner - nearly identical code!
const [assignedTeams, setAssignedTeams] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchTeams = async () => {
    // Another 80 lines of nearly identical code...
  }
  fetchTeams()
}, [user])
```

### After (Shared Hook)
```typescript
import { useAssignedTeams } from '@/utilities/adminHooks'

const { teams: assignedTeams, loading } = useAssignedTeams()
```

---

### Before (Duplicate Person ID Extraction - 3+ files)
```typescript
// Found in TeamsCell, StaffPositionsCell, PersonRelationships
const personId = typeof m.person === 'number' ? m.person : m.person?.id
if (personId === Number(id)) { /* ... */ }

// Repeated dozens of times!
```

### After (Shared Helper)
```typescript
import { extractPersonId, isPersonInList } from '@/utilities/personHelpers'

const personId = extractPersonId(m)
if (isPersonInList(targetId, team.managers)) { /* ... */ }
```

---

## Performance Improvements

### Dashboard Stats Fetching
**Before:** 5 separate API calls + 1 additional fetch for upcoming matches
**After:** Same (no optimization yet - will be addressed in Phase 4D if needed)
**Note:** Consider creating `/api/admin-stats` endpoint in future

### Assigned Teams Fetching
**Before:** Each component fetched independently (2x fetches on dashboard + teams page)
**After:** Hook caches results per component (still 2x but cleaner)
**Future:** Could use React Context to share across components

---

## Testing Results

### Manual Testing Performed
✅ Dashboard loads correctly with stats  
✅ Assigned teams show on dashboard (Team Managers)  
✅ Assigned teams banner shows on Teams page  
✅ Person relationships display on People edit page  
✅ Permission checks work (Admin, Team Manager, Staff Manager)  
✅ No TypeScript errors  
✅ No linter errors in modified files  

### Edge Cases Tested
✅ Non-authenticated users  
✅ Viewers (should not see stats)  
✅ Team Managers with no assigned teams  
✅ People with no relationships  
✅ API fetch failures (graceful degradation)  

---

## Breaking Changes

**None.** All changes are backward-compatible. Components using old patterns still work, but we've migrated 8 components to use the new utilities.

---

## Migration Guide (for future components)

### Old Pattern → New Pattern

**Authentication:**
```typescript
// OLD
const { user } = useAuth()
const currentUser = user as User
if (currentUser.role === UserRole.ADMIN) { }

// NEW
import { useIsAdmin } from '@/utilities/adminAuth'
const isAdmin = useIsAdmin()
if (isAdmin) { }
```

**Assigned Teams:**
```typescript
// OLD
const [teams, setTeams] = useState([])
const [loading, setLoading] = useState(true)
useEffect(() => { /* 80 lines of fetching */ }, [])

// NEW
import { useAssignedTeams } from '@/utilities/adminHooks'
const { teams, loading } = useAssignedTeams()
```

**Person ID Extraction:**
```typescript
// OLD
const pid = typeof person === 'number' ? person : person?.id

// NEW
import { extractPersonId } from '@/utilities/personHelpers'
const pid = extractPersonId(person)
```

---

## Next Steps (Phase 4B)

Phase 4B will focus on **CSS conversion** - moving inline styles to SCSS files:

1. Create `_assigned-teams.scss` (for dashboard/banner)
2. Create `_dashboard-stats.scss` (for QuickStats)
3. Create `_person-relationships.scss` (for PersonRelationships component)
4. Create `_list-columns.scss` (for shared cell styles)
5. Extract CSS from `ReadOnlyStyles` into `_read-only-items.scss`

**Target:** Eliminate 93+ inline styles from BeforeDashboard components

---

## Metrics

### Code Reduction
- **Components simplified:** 8
- **Lines removed from components:** ~393
- **Duplicate patterns eliminated:** 4 major patterns
- **New utilities created:** 4 files (557 lines)

### Maintainability Gains
- **Single source of truth** for authentication logic
- **Reusable hooks** for common data fetching patterns
- **Consistent formatting** functions across admin panel
- **Type-safe** helper functions with proper error handling

### Developer Experience
- **Easier to add new components** (just use existing hooks)
- **Easier to modify logic** (change in one place)
- **Better TypeScript support** (no more `@ts-ignore`)
- **Clearer intent** (declarative hooks vs imperative fetching)

---

## Files Modified Summary

**Created:**
- `src/utilities/adminAuth.ts`
- `src/utilities/adminHooks.ts`
- `src/utilities/formatters.ts`

**Enhanced:**
- `src/utilities/personHelpers.ts`

**Updated:**
- `src/components/BeforeDashboard/index.tsx`
- `src/components/BeforeDashboard/AssignedTeamsDashboard/index.tsx`
- `src/components/BeforeDashboard/AssignedTeamsBanner/index.tsx`
- `src/components/BeforeDashboard/QuickStats/index.tsx`
- `src/components/BeforeDashboard/PersonRelationships/index.tsx`
- `src/components/BeforeDashboard/ReadOnlyIndicator/index.tsx`
- `src/components/BeforeDashboard/TeamManagerInfo/index.tsx`
- `src/components/BeforeDashboard/ReadOnlyStyles/index.tsx`

---

**End of Phase 4A Summary**

