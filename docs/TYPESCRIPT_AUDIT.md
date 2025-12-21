# TypeScript/React Codebase Audit

**Date:** December 21, 2025  
**Total Files Audited:** 209 TypeScript files  
**Status:** Comprehensive review completed

---

## Executive Summary

Following our successful CSS refactoring, this audit identifies redundancies, duplications, and improvement opportunities in our TypeScript/React codebase. The findings reveal significant opportunities for consolidation, especially in utility functions, API routes, and component patterns.

### Key Findings

- **🔴 Critical:** 2 completely duplicate files (419 lines each)
- **🟠 High Priority:** 5 duplicate utility functions across multiple files
- **🟡 Medium Priority:** 17 debug/temporary API routes that should be cleaned up
- **🟢 Low Priority:** Multiple inline style patterns that could use CSS classes
- **📊 Large Files:** 10 files over 400 lines that could benefit from splitting

---

## 1. 🔴 Critical Issues - Duplicate Files

### 1.1 Identical Component Files

**Files:**
- `src/components/DataConsistencyView.tsx` (419 lines)
- `src/components/DataConsistencyPage.tsx` (419 lines)

**Issue:** These files are 100% identical (confirmed via `diff`). They contain the exact same:
- Component logic
- State management
- API calls
- UI rendering

**Impact:** 
- Code maintenance burden (changes must be made twice)
- Potential for divergence over time
- Unnecessary bundle size increase

**Recommendation:**
```typescript
// Keep ONE file: src/components/DataConsistencyView.tsx
// Delete: src/components/DataConsistencyPage.tsx
// Update all imports to use DataConsistencyView
```

**Action Items:**
1. Search for all imports of `DataConsistencyPage`
2. Replace with `DataConsistencyView`
3. Delete `DataConsistencyPage.tsx`
4. Verify no build errors

---

## 2. 🟠 High Priority - Duplicate Utility Functions

### 2.1 Role Icon Functions (5 duplicates)

**Locations:**
1. `src/components/TeamCard/index.tsx` - Game roles (tank/dps/support)
2. `src/app/(frontend)/teams/[slug]/page.tsx` - Game roles with size variants
3. `src/app/(frontend)/staff/page.tsx` - Organization roles
4. `src/app/(frontend)/players/[slug]/page.tsx` - Organization roles
5. `src/app/(frontend)/organization-staff/[slug]/page.tsx` - Organization roles

**Current Implementation (example):**
```typescript
// Duplicated 5 times across codebase
const getRoleIcon = (role: string) => {
  switch (role) {
    case 'tank':
      return <Shield className="w-3 h-3 text-blue-500" />
    case 'dps':
      return <Swords className="w-3 h-3 text-red-500" />
    case 'support':
      return <Heart className="w-3 h-3 text-green-500" />
    default:
      return null
  }
}
```

**Recommendation:** Create centralized utility

```typescript
// src/utilities/roleIcons.tsx
import { Shield, Swords, Heart, Crown, UserCheck, Calendar, Share2, Image, Film, Users } from 'lucide-react'

export type GameRole = 'tank' | 'dps' | 'support'
export type OrgRole = 'owner' | 'co-owner' | 'hr' | 'moderator' | 'event-manager' | 'social-manager' | 'graphics' | 'media-editor'
export type IconSize = 'sm' | 'md' | 'lg'

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export function getGameRoleIcon(role: GameRole, size: IconSize = 'sm') {
  const sizeClass = sizeClasses[size]
  
  switch (role) {
    case 'tank':
      return <Shield className={`${sizeClass} text-blue-500`} />
    case 'dps':
      return <Swords className={`${sizeClass} text-red-500`} />
    case 'support':
      return <Heart className={`${sizeClass} text-green-500`} />
    default:
      return null
  }
}

export function getOrgRoleIcon(role: string, size: IconSize = 'sm') {
  const sizeClass = sizeClasses[size]
  const roleLower = role.toLowerCase().replace(/\s+/g, '-')
  
  const iconMap: Record<string, any> = {
    'owner': Crown,
    'co-owner': Crown,
    'hr': UserCheck,
    'moderator': Shield,
    'event-manager': Calendar,
    'social-manager': Share2,
    'graphics': Image,
    'media-editor': Film,
  }
  
  const Icon = iconMap[roleLower] || Users
  return <Icon className={sizeClass} />
}

export function getGameRoleColor(role: GameRole): string {
  switch (role) {
    case 'tank': return 'text-blue-500'
    case 'dps': return 'text-red-500'
    case 'support': return 'text-green-500'
    default: return 'text-muted-foreground'
  }
}
```

**Files to Update:**
- `src/components/TeamCard/index.tsx`
- `src/app/(frontend)/teams/[slug]/page.tsx`
- `src/app/(frontend)/staff/page.tsx`
- `src/app/(frontend)/players/[slug]/page.tsx`
- `src/app/(frontend)/organization-staff/[slug]/page.tsx`

**Estimated Reduction:** ~150 lines of duplicate code

---

### 2.2 Date/Time Formatting Functions

**Locations:**
1. `src/utilities/formatDateTime.ts` - Basic date formatting (only used once)
2. `src/app/(frontend)/matches/page.tsx` - Multiple date/time functions
3. `src/app/(payload)/admin/schedule-generator/page.tsx` - Similar date functions

**Current State:**
```typescript
// src/utilities/formatDateTime.ts - underutilized
export const formatDateTime = (timestamp: string): string => {
  // Only formats as MM/DD/YYYY
  // Has commented-out time formatting code
}

// src/app/(frontend)/matches/page.tsx - duplicated logic
function formatDate(date: Date): string { /* ... */ }
function formatTime(date: Date): string { /* ... */ }
function convertToEST(date: Date): string { /* ... */ }
function convertToCET(date: Date): string { /* ... */ }
function getWeekRange(date: Date = new Date()) { /* ... */ }
```

**Recommendation:** Consolidate into comprehensive utility

```typescript
// src/utilities/formatDateTime.ts - Enhanced version
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  const YYYY = d.getFullYear()
  return `${MM}/${DD}/${YYYY}`
}

export const convertToTimezone = (date: Date | string, timezone: string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const timeString = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(d)
  
  // Get timezone abbreviation
  const abbr = timezone.includes('New_York') ? 'EST' : 
               timezone.includes('Berlin') ? 'CET' : 
               timezone.split('/').pop()
  
  return `${timeString} ${abbr}`
}

export const getWeekRange = (date: Date = new Date()): { startOfWeek: Date; endOfWeek: Date } => {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return { startOfWeek, endOfWeek }
}
```

**Files to Update:**
- `src/app/(frontend)/matches/page.tsx`
- `src/app/(payload)/admin/schedule-generator/page.tsx`

---

### 2.3 Authentication Pattern in API Routes

**Issue:** 6 API routes use identical authentication boilerplate

**Locations:**
1. `src/app/api/seed-teams/route.ts`
2. `src/app/api/migrate-to-people/route.ts`
3. `src/app/api/debug-people-query/route.ts`
4. `src/app/api/fix-staff-relationships/route.ts`
5. `src/app/api/check-data-consistency/route.ts`
6. `src/app/api/check-people-names/route.ts`

**Current Pattern (repeated 6 times):**
```typescript
export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    
    // Authenticate the request
    const { user } = await payload.auth({ headers: requestHeaders })
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 403 }
      )
    }
    
    // ... actual logic
  } catch (error: unknown) {
    // ... error handling
  }
}
```

**Recommendation:** Create authentication middleware/helper

```typescript
// src/utilities/apiAuth.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import type { User } from '@/payload-types'

export interface AuthenticatedContext {
  payload: any
  user: User
}

/**
 * Authenticate API request and return payload + user
 * Returns error response if authentication fails
 */
export async function authenticateRequest(): Promise<
  { success: true; data: AuthenticatedContext } | 
  { success: false; response: NextResponse }
> {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    
    const { user } = await payload.auth({ headers: requestHeaders })
    
    if (!user) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 403 }
        )
      }
    }
    
    return {
      success: true,
      data: { payload, user }
    }
  } catch (error) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }
}

/**
 * Standard error response for API routes
 */
export function apiErrorResponse(error: unknown, defaultMessage = 'An error occurred'): NextResponse {
  const errorMessage = error instanceof Error ? error.message : defaultMessage
  return NextResponse.json(
    { success: false, error: errorMessage },
    { status: 500 }
  )
}
```

**Usage Example:**
```typescript
// src/app/api/check-data-consistency/route.ts
import { authenticateRequest, apiErrorResponse } from '@/utilities/apiAuth'
import { checkDataConsistency } from '@/utilities/checkDataConsistency'

export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  
  const { payload, user } = auth.data
  
  try {
    const report = await checkDataConsistency(payload)
    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to check data consistency')
  }
}
```

**Estimated Reduction:** ~120 lines of duplicate code

---

## 3. 🟡 Medium Priority - API Route Cleanup

### 3.1 Debug/Temporary Routes (Should be Removed)

The following API routes appear to be debug/development endpoints that should be removed or moved to a dev-only section:

**Debug Routes (7):**
1. `src/app/api/debug-dragon/route.ts` - Dragon team debugging
2. `src/app/api/debug-team-fetch/route.ts` - Team fetch debugging
3. `src/app/api/debug-team-logos/route.ts` - Logo debugging
4. `src/app/api/debug-teams/route.ts` - General team debugging
5. `src/app/api/debug-people-query/route.ts` - People query debugging
6. `src/app/api/check-person/[id]/route.ts` - Person inspection
7. `src/app/api/check-people-names/route.ts` - Name validation

**Migration/Fix Routes (10):**
1. `src/app/api/migrate-to-people/route.ts` - One-time migration
2. `src/app/api/fix-data-issues/route.ts` - Data cleanup
3. `src/app/api/fix-match-titles/route.ts` - Match title fixes
4. `src/app/api/fix-person-names/route.ts` - Name fixes
5. `src/app/api/fix-staff-relationships/route.ts` - Relationship fixes

**Recommendation:**

```typescript
// Option 1: Remove entirely if no longer needed
// Option 2: Move to dev-only routes with environment check

// src/app/api/dev/debug/route.ts
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }
  
  // Debug logic here
}
```

**Benefits:**
- Cleaner API surface
- Reduced attack surface in production
- Clearer separation of concerns

---

### 3.2 Duplicate Data Consistency Endpoints

**Issue:** Two endpoints do similar things

1. `src/app/api/check-data-consistency/route.ts` - Uses `checkDataConsistency` utility
2. `src/app/api/data-consistency-check/route.ts` - Custom inline logic

**Recommendation:**
- Keep `check-data-consistency` (uses centralized utility)
- Remove or redirect `data-consistency-check`
- Update frontend to use single endpoint

---

## 4. 🟢 Low Priority - Component Improvements

### 4.1 Card Component Confusion

**Issue:** Three different "Card" implementations

1. `src/components/Card/index.tsx` - Page card with clickable functionality
2. `src/components/TeamCard/index.tsx` - Team-specific card with hover details
3. `src/components/ui/card.tsx` - Generic UI card primitives (shadcn)

**Current State:**
- Different purposes but similar names
- Potential for confusion when importing

**Recommendation:**
```typescript
// Rename for clarity
src/components/Card/index.tsx → src/components/PageCard/index.tsx
// Keep TeamCard as is (specific purpose)
// Keep ui/card.tsx as is (UI primitives)
```

---

### 4.2 Inline Styles vs CSS Classes

**Issue:** Heavy use of inline styles in several components

**Components with extensive inline styles:**
1. `src/components/BeforeDashboard/QuickStats/index.tsx` - Stats cards
2. `src/components/BeforeDashboard/HelpTooltip/index.tsx` - Tooltip positioning
3. `src/components/BeforeDashboard/GradientBorder/index.tsx` - Gradient effect
4. `src/components/BeforeDashboard/DataConsistencyCheck/index.tsx` - Various styles

**Example Issue:**
```typescript
// QuickStats - inline hover handlers
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
  e.currentTarget.style.borderColor = stat.color
  e.currentTarget.style.transform = 'translateY(-3px)'
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
}}
```

**Recommendation:**
- Move to CSS classes with hover states
- Use Tailwind utilities where appropriate
- Keep inline styles only for truly dynamic values (like `stat.color`)

**Example Refactor:**
```typescript
// Add to admin panel styles
.stat-card {
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--theme-elevation-100);
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

// Component
<a 
  className="stat-card"
  style={{ borderColor: stat.color }} // Only dynamic value
>
```

---

### 4.3 Cell Alignment Style Components

**Issue:** Two identical components for table cell alignment

1. `src/components/MatchesListColumns/CellAlignmentStyles.tsx`
2. `src/components/TeamsListColumns/CellAlignmentStyles.tsx`

**Both contain:**
```typescript
<style jsx global>{`
  [class*="Table__table"] tr[class*="Table__row"] td[class*="Table__cell"] {
    vertical-align: middle !important;
  }
  /* ... more styles */
`}</style>
```

**Recommendation:**
- Create single shared component: `src/components/PayloadTableStyles/index.tsx`
- Import in both list views
- Or better: Add to global admin styles if it applies to all tables

---

## 5. 📊 Large Files - Split Candidates

### Files Over 400 Lines

| File | Lines | Recommendation |
|------|-------|----------------|
| `src/payload-types.ts` | 1,598 | Auto-generated, leave as is |
| `src/app/(frontend)/matches/page.tsx` | 1,135 | Split into components |
| `src/migrations/20251217_055734.ts` | 941 | Migration file, leave as is |
| `src/app/(frontend)/staff/page.tsx` | 635 | Split into components |
| `src/app/(frontend)/teams/[slug]/page.tsx` | 628 | Split into components |
| `src/endpoints/seed/home.ts` | 608 | Seed file, acceptable |
| `src/collections/Teams/index.ts` | 487 | Consider splitting config |
| `src/utilities/getPlayer.ts` | 441 | Split into multiple functions |
| `src/components/DataConsistencyView.tsx` | 419 | Split into sub-components |
| `src/app/(payload)/admin/schedule-generator/page.tsx` | 435 | Split into components |

### 5.1 Matches Page (1,135 lines)

**Current Structure:**
- Date formatting functions
- Data fetching logic
- Upcoming matches section
- Past matches section with pagination
- Search functionality
- Multiple UI sections

**Recommended Split:**
```
src/app/(frontend)/matches/
  ├── page.tsx (main page, ~200 lines)
  ├── components/
  │   ├── MatchCard.tsx
  │   ├── MatchesList.tsx
  │   ├── UpcomingMatches.tsx
  │   ├── PastMatches.tsx
  │   └── MatchFilters.tsx
  └── utils/
      └── matchHelpers.ts (date functions, filtering)
```

---

### 5.2 Staff Page (635 lines)

**Current Structure:**
- Helper functions for grouping/sorting
- Role icon mapping
- Complex rendering logic
- Multiple sections

**Recommended Split:**
```
src/app/(frontend)/staff/
  ├── page.tsx (main page, ~150 lines)
  ├── components/
  │   ├── StaffCard.tsx
  │   ├── StaffGrid.tsx
  │   └── StaffSection.tsx
  └── utils/
      └── staffHelpers.ts (grouping, sorting)
```

---

### 5.3 Team Detail Page (628 lines)

**Recommended Split:**
```
src/app/(frontend)/teams/[slug]/
  ├── page.tsx (main page, ~150 lines)
  └── components/
      ├── TeamHeader.tsx
      ├── TeamRoster.tsx
      ├── TeamStaff.tsx
      ├── TeamAchievements.tsx
      └── TeamSocial.tsx
```

---

## 6. 🎯 Naming Consistency Issues

### 6.1 Inconsistent Function Naming

**Issue:** Mix of naming conventions

```typescript
// Some use camelCase
export async function getAllTeams()
export async function getTeamBySlug()

// Some use PascalCase for components
export const QuickStats: React.FC = () => {}

// Some use function declarations
function formatDate(date: Date): string {}

// Some use arrow functions
const formatTime = (date: Date): string => {}
```

**Recommendation:**
- **Components:** PascalCase with arrow function + React.FC
- **Utilities:** camelCase with function declaration
- **Hooks:** camelCase starting with "use"
- **Constants:** UPPER_SNAKE_CASE

---

### 6.2 File Naming Inconsistency

**Current Mix:**
- `index.tsx` (most components)
- `Component.tsx` (some blocks)
- `Component.client.tsx` (client components)
- `config.ts` (configuration)

**Recommendation:** Standardize on:
- `index.tsx` for component entry points
- `Component.client.tsx` for client-only components
- `types.ts` for type definitions
- `utils.ts` or `helpers.ts` for utilities

---

## 7. 📋 Action Plan

### Phase 1: Critical (Week 1)
- [ ] Remove duplicate `DataConsistencyPage.tsx`
- [ ] Create centralized `roleIcons.tsx` utility
- [ ] Create `apiAuth.ts` authentication helper
- [ ] Update all API routes to use new auth helper

### Phase 2: High Priority (Week 2)
- [ ] Consolidate date/time formatting utilities
- [ ] Remove or move debug API routes
- [ ] Consolidate data consistency endpoints
- [ ] Create shared table styles component

### Phase 3: Medium Priority (Week 3)
- [ ] Rename `Card` to `PageCard` for clarity
- [ ] Split matches page into components
- [ ] Split staff page into components
- [ ] Split team detail page into components

### Phase 4: Low Priority (Week 4)
- [ ] Convert inline styles to CSS classes
- [ ] Standardize naming conventions
- [ ] Update documentation
- [ ] Add ESLint rules to prevent regressions

---

## 8. 📈 Expected Benefits

### Code Quality
- **Reduced Duplication:** ~500+ lines of duplicate code removed
- **Better Organization:** Clearer file structure and responsibilities
- **Easier Maintenance:** Changes in one place instead of many

### Performance
- **Smaller Bundle:** Removing duplicates reduces bundle size
- **Better Tree Shaking:** Centralized utilities are easier to optimize
- **Faster Builds:** Fewer files to process

### Developer Experience
- **Clearer Imports:** Know exactly where to find utilities
- **Consistent Patterns:** Easier to understand and contribute
- **Better TypeScript:** Centralized types reduce errors

---

## 9. 🛡️ Prevention Strategies

### ESLint Rules to Add

```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      // Prevent inline styles in admin components
      'react/forbid-dom-props': ['error', { 
        forbid: ['style'] // Can be overridden with eslint-disable
      }],
      
      // Enforce consistent function declarations
      'func-style': ['error', 'declaration', { 
        allowArrowFunctions: true 
      }],
      
      // Prevent duplicate imports
      'no-duplicate-imports': 'error',
      
      // Enforce consistent naming
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase']
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase']
        }
      ]
    }
  }
]
```

### Code Review Checklist

- [ ] No duplicate utility functions
- [ ] No inline styles without justification
- [ ] Consistent naming conventions
- [ ] Files under 400 lines
- [ ] Shared logic extracted to utilities
- [ ] API routes use authentication helper
- [ ] Components use existing UI primitives

---

## 10. 📚 Related Documentation

- [CSS Audit](./CSS_AUDIT.md) - Previous CSS refactoring
- [CSS Refactoring Complete](./CSS_REFACTORING_COMPLETE.md) - CSS improvements
- [Admin Panel Structure](./ADMIN_STRUCTURE.md) - Admin architecture
- [Cursor CSS Rules](./CURSOR_CSS_RULES.md) - CSS guidelines

---

## Appendix A: File Statistics

### Component Files by Directory

```
src/components/
  ├── BeforeDashboard/     18 files (admin dashboard)
  ├── ui/                   8 files (shadcn primitives)
  ├── TeamsListColumns/     7 files (team list cells)
  ├── MatchesListColumns/   2 files (match list cells)
  ├── PeopleListColumns/    2 files (people list cells)
  └── Other components/    29 files

Total: 66 component files
```

### API Routes

```
src/app/api/
  ├── Debug routes:        7 files (should be removed/moved)
  ├── Migration routes:    5 files (one-time use)
  ├── Active routes:       5 files (keep)
  └── Total:              17 files
```

### Utility Files

```
src/utilities/
  ├── Data fetching:       4 files (getTeams, getPlayer, etc.)
  ├── Helpers:            19 files (various utilities)
  └── Total:              23 files
```

---

## Appendix B: Import Analysis

### Most Imported Utilities

1. `lucide-react` - 17 files (icon library)
2. `@/utilities/ui` (cn function) - Used extensively
3. `@/utilities/personHelpers` - 8+ files
4. `@/utilities/getTeams` - 6+ files

### Unused or Underutilized

1. `src/utilities/formatDateTime.ts` - Only used in 2 places, could be expanded
2. `src/utilities/useDebounce.ts` - Only used once
3. `src/utilities/toKebabCase.ts` - Only used once

---

**End of Audit**

*This audit provides a roadmap for improving code quality and maintainability. Prioritize based on your team's capacity and immediate needs.*

