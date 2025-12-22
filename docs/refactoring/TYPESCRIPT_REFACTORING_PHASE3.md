# TypeScript/React Refactoring - Phase 3: Component Splitting

**Date**: December 21, 2025  
**Status**: In Progress  
**Goal**: Split large page files into focused, reusable components

## Overview

Phase 3 focuses on breaking down the largest page files identified in the audit into smaller, manageable components. This improves:
- **Maintainability**: Easier to understand and modify individual components
- **Reusability**: Components can be shared across pages
- **Testing**: Smaller components are easier to test
- **Performance**: Better code splitting opportunities

## Progress

### ✅ 1. matches/page.tsx (1,135 → 154 lines, 86% reduction)

**Before**: 1,135 lines  
**After**: 154 lines (main page) + 1,145 lines (components) = 1,299 total  
**Reduction**: 86% in main file

**Components Created**:
- `MatchesHeader.tsx` (37 lines) - Page header with counts
- `LiveBanner.tsx` (38 lines) - Live matches alert banner
- `MatchCard.tsx` (583 lines) - Individual match display with all details
- `UpcomingMatches.tsx` (109 lines) - Upcoming matches section with day grouping
- `PastMatchCard.tsx` (207 lines) - Simplified past match display
- `PastMatches.tsx` (131 lines) - Past matches section with pagination
- `NoResults.tsx` (40 lines) - Search no results message

**Benefits**:
- Main page is now just data fetching and composition
- Match rendering logic is centralized in reusable cards
- Pagination logic is isolated
- Easy to modify individual sections without touching others

---

### ✅ 2. staff/page.tsx (635 → 274 lines, 57% reduction)

**Before**: 635 lines  
**After**: 274 lines (main page) + 533 lines (components) = 807 total  
**Reduction**: 57% in main file

**Components Created**:
- `StaffHeader.tsx` (22 lines) - Page header
- `StaffMemberCard.tsx` (68 lines) - Reusable staff member card with avatar and social links
- `OrganizationStaffSection.tsx` (171 lines) - Organization roles (Owner, HR, Moderator, etc.)
- `ProductionStaffSection.tsx` (119 lines) - Production staff (Casters, Observers, Producers)
- `EsportsStaffSection.tsx` (153 lines) - Esports staff (Managers, Coaches, Captains)

**Benefits**:
- Staff member card is now reusable across all sections
- Each staff category is isolated with its own styling logic
- Color mapping and role logic is encapsulated per section
- Debug information is cleanly separated

---

### 🔄 3. teams/[slug]/page.tsx (615 lines) - IN PROGRESS

**Target**: Split into focused components

**Identified Sections**:
- Team hero section with logo and info
- Team stats sidebar
- Staff section (managers, coaches, captains)
- Roster section (main roster + subs)
- Achievements section

**Planned Components**:
- `TeamHero.tsx` - Hero section with logo, name, region, rating
- `TeamStatsSidebar.tsx` - Stats sidebar
- `TeamStaffSection.tsx` - Staff display
- `TeamRosterSection.tsx` - Roster with role grouping
- `PlayerCard.tsx` - Individual player card (reusable)

---

### ⏳ 4. DataConsistencyView.tsx (419 lines) - PENDING

**Target**: Split into focused components

**Identified Sections**:
- Data consistency check results
- Issue grouping and display
- Fix suggestions
- Action buttons

---

## Metrics

| File | Before | After (Main) | Components | Total | Reduction |
|------|--------|--------------|------------|-------|-----------|
| matches/page.tsx | 1,135 | 154 | 1,145 | 1,299 | **86%** |
| staff/page.tsx | 635 | 274 | 533 | 807 | **57%** |
| teams/[slug]/page.tsx | 615 | TBD | TBD | TBD | TBD |
| DataConsistencyView.tsx | 419 | TBD | TBD | TBD | TBD |

## Key Patterns Established

### 1. Component Organization
- Create a `components/` directory next to the page file
- Name components descriptively (e.g., `MatchCard`, not `Card`)
- Keep related components together

### 2. Component Responsibilities
- **Header components**: Just display, no logic
- **Card components**: Display + internal state (hover, etc.)
- **Section components**: Grouping + iteration logic
- **Page component**: Data fetching + composition

### 3. Props Over Context
- Pass data explicitly via props
- Keep components pure and testable
- Avoid hidden dependencies

### 4. Utility Function Reuse
- Helper functions stay in utilities
- Components focus on rendering
- Share utilities across components

## Next Steps

1. ✅ Complete teams/[slug]/page.tsx split
2. ⏳ Split DataConsistencyView.tsx
3. ⏳ Convert inline styles to CSS classes (Phase 3.5)
4. ⏳ Document component patterns in style guide

## Notes

- Total line count may increase slightly due to imports and component boundaries
- **The goal is readability and maintainability, not just fewer lines**
- Components are easier to test, modify, and reuse
- Better code splitting opportunities for performance

