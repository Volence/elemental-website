# Icon Usage Guide - Role Icons vs UI Decoration

**Date:** December 21, 2025  
**Purpose:** Clarify which icons use the utility and which are direct imports

---

## 🎯 The Strategy

We centralized **role-based icons** into utilities while keeping **UI decoration icons** as direct imports.

---

## ✅ Icons Using Centralized Utility

### Game Role Icons (Tank/DPS/Support)

**Utility Function:** `getGameRoleIcon(role, size)`  
**Location:** `src/utilities/roleIcons.tsx`

| Icon | Color | Usage |
|------|-------|-------|
| Shield | Blue | Tank role |
| Swords | Red | DPS role |
| Heart | Green | Support role |

**Files Using Utility:**
1. `src/components/TeamCard/index.tsx` - Team hover card roster
2. `src/app/(frontend)/teams/[slug]/page.tsx` - Team detail roster (2 instances)

---

### Organization Role Icons

**Utility Function:** `getOrgRoleIcon(role, size)`  
**Location:** `src/utilities/roleIcons.tsx`

| Icon | Roles |
|------|-------|
| Crown | Owner, Co-Owner |
| UserCheck | HR |
| Shield | Moderator |
| Calendar | Event Manager |
| Share2 | Social Manager |
| Image | Graphics |
| Film | Media Editor |
| Users | Default/Fallback |

**Files Using Utility:**
1. `src/app/(frontend)/staff/page.tsx` - Staff listing page
2. `src/app/(frontend)/players/[slug]/page.tsx` - Player org roles
3. `src/app/(frontend)/organization-staff/[slug]/page.tsx` - Org staff detail

---

## 🎨 Icons Used for UI Decoration (Direct Imports)

These icons are **NOT** role indicators - they're used for visual hierarchy and UI organization.

### src/app/(frontend)/teams/[slug]/page.tsx

**Imports:** `Shield, Lock, Users, Trophy, MapPin, Star`

| Icon | Usage | Line | Purpose |
|------|-------|------|---------|
| Shield | `<Shield className="w-6 h-6 text-primary" />` | 334 | Staff section header |
| Shield | `<Shield className="w-16 h-16 text-muted-foreground..." />` | 469 | Empty state decoration |
| Users | Section headers | Multiple | Roster section |
| Lock | Section decorations | Multiple | Substitutes section |
| Trophy | Achievements | N/A | Team achievements |
| MapPin | Region | N/A | Team location |
| Star | Ratings | N/A | Team rating |

---

### src/app/(frontend)/players/[slug]/page.tsx

**Imports:** `Shield, Crown, Share2, Users, Mic, Eye, Video`

| Icon | Usage | Line | Purpose |
|------|-------|------|---------|
| Shield | `<Shield className="w-6 h-6 text-primary" />` | 249 | Staff Positions header |
| Shield | `<Shield className="w-6 h-6 text-primary" />` | 302 | Teams section header |
| Crown | `<Crown className="w-4 h-4" />` | 256 | Organization Staff subheader |
| Share2 | `<Share2 className="w-5 h-5 text-primary" />` | 361 | Social Links header |
| Video | Production role | N/A | Production staff indicator |
| Mic | Caster role | N/A | Caster indicator |
| Eye | Observer role | N/A | Observer indicator |
| Users | General | N/A | Generic user/people icon |

---

### src/app/(frontend)/staff/page.tsx

**Imports:** `Shield, Users, Mic, Eye, Video`

| Icon | Usage | Line | Purpose |
|------|-------|------|---------|
| Shield | `<Shield className="w-8 h-8" />` | 462 | Esports Staff section header |
| Users | `<Users className="w-8 h-8" />` | 377 | Production Staff section header |
| Mic | Caster indicator | N/A | Production role |
| Eye | Observer indicator | N/A | Production role |
| Video | Producer indicator | N/A | Production role |

---

### src/components/TeamCard/index.tsx

**Imports:** `Lock, Users, UserCheck`

| Icon | Usage | Line | Purpose |
|------|-------|------|---------|
| Users | `<Users className="w-3 h-3" />` | 70 | Staff subsection label |
| Lock | `<Lock className="w-3 h-3 text-orange-500" />` | 126, 132 | Substitutes indicator |
| UserCheck | Team staff | N/A | Staff indicator |

---

### src/app/(frontend)/organization-staff/[slug]/page.tsx

**Imports:** None needed! ✅

This file uses **only** the utility functions:
- `getOrgRoleIcon(role, 'lg')`
- `getOrgRoleLabel(role)`

**Perfect example** of full refactoring!

---

## 📊 Summary Table

| File | Role Icons (Utility) | UI Icons (Direct) |
|------|---------------------|-------------------|
| `TeamCard/index.tsx` | ✅ `getGameRoleIcon()` | Lock, Users, UserCheck |
| `teams/[slug]/page.tsx` | ✅ `getGameRoleIcon()` | Shield, Lock, Users, Trophy, MapPin, Star |
| `staff/page.tsx` | ✅ `getOrgRoleIcon()` | Shield, Users, Mic, Eye, Video |
| `players/[slug]/page.tsx` | ✅ `getOrgRoleIcon()` | Shield, Crown, Share2, Users, Mic, Eye, Video |
| `organization-staff/[slug]/page.tsx` | ✅ `getOrgRoleIcon()` | ❌ None |

---

## 🎯 Decision Rules

### Use Centralized Utility When:
- ✅ Icon represents a **role** (game role or org role)
- ✅ Icon color is **role-specific** (blue tank, red dps, green support)
- ✅ Multiple files need the **same role logic**
- ✅ Icon is **dynamically selected** based on data

### Use Direct Import When:
- ✅ Icon is for **visual hierarchy** (section headers)
- ✅ Icon is **decorative** (empty states, banners)
- ✅ Icon color is **theme-based** (text-primary, text-muted-foreground)
- ✅ Icon is used **only once** for UI purposes
- ✅ Icon meaning is **context-specific** (not a role)

---

## 🔍 Quick Reference

### For Game Roles (Tank/DPS/Support)
```typescript
import { getGameRoleIcon } from '@/utilities/roleIcons'

// Usage
{getGameRoleIcon(player.role, 'md')}
```

### For Organization Roles
```typescript
import { getOrgRoleIcon, getOrgRoleLabel } from '@/utilities/roleIcons'

// Usage
const Icon = getOrgRoleIcon(role, 'lg')
const label = getOrgRoleLabel(role)
```

### For UI Decoration
```typescript
import { Shield, Users, Lock } from 'lucide-react'

// Usage
<h2>
  <Shield className="w-6 h-6 text-primary" />
  Section Title
</h2>
```

---

## ✅ All Files Verified

**Linter Status:** 0 errors  
**Build Status:** ✅ Ready

All files have been checked and verified:
- ✅ Role icons use centralized utilities
- ✅ UI decoration icons are directly imported where needed
- ✅ No unused imports
- ✅ No missing imports
- ✅ Consistent patterns across codebase

---

**This guide ensures we maintain the right balance between DRY principles and practical code organization.**


