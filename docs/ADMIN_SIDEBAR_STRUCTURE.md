# Admin Sidebar Structure

**Last Updated:** December 29, 2025

This document outlines the admin panel sidebar organization and navigation structure.

---

## Current Structure (After Reorganization)

### 🎯 Dashboard
**Top Level Link** - Always visible  
Quick overview and role-based quick actions.

---

### 👥 PEOPLE
**Collections:**
1. **People** - All players, staff, casters (centralized)
2. **Teams** - Team rosters, staff, FaceIt integration
3. **FaceIt Leagues** - Competition structures teams participate in (Admin only)

**Purpose:** Managing all personnel, teams, and competitions they're in  
**Access:** Managers and Admins  
**Note:** FaceIt Leagues moved here because it's team/competition metadata, not broadcast operations

---

### 🎙️ STAFF
**Collections:**
1. **Production Staff** - Casters, observers, producers
2. **Organization Staff** - Owners, HR, moderators

**Purpose:** Managing staff members across departments  
**Access:** Staff Managers and Admins

---

### 🎬 PRODUCTION
**Collections:**
1. **Matches** - Match management
2. **Tournament Templates** - Recurring match schedules

**Globals:**
3. **Production Dashboard** - Weekly coverage planning

**Purpose:** Managing competitive matches and broadcast schedule  
**Access:** Production staff, Managers, Admins  
**Note:** FaceIt Seasons collection is hidden (managed through Teams). FaceIt Leagues moved to PEOPLE.

---

### 📱 SOCIAL MEDIA
**Collections:**
1. **Social Posts** - Content calendar and posts

**Globals:**
2. **Social Media Dashboard** - Posting schedule
3. **Social Media Settings** - Templates and guidelines

**Purpose:** Managing social media content  
**Access:** Social Media managers and Admins

---

### 📋 RECRUITMENT
**Collections:**
1. **Recruitment Listings** - Open positions
2. **Recruitment Applications** - Player applications

**Purpose:** Managing player recruitment  
**Access:** Team Managers and Admins

---

### ⚙️ SYSTEM
**Collections:**
1. **Users** - Admin panel users and permissions
2. **Invite Links** - Generate user invites
3. **Ignored Duplicates** - Manage name duplicates (Admin only)

**Globals:**
4. **Data Consistency** - Data validation and cleanup (Admin only)

**Purpose:** System administration and maintenance  
**Access:** Mostly Admin only

---

### 🚪 LOG OUT
**Bottom of Sidebar** - Payload's built-in logout  
(Custom logout button removed to prevent duplication)

---

## Hidden Collections
These don't appear in the sidebar but are accessible via direct URL:

- **Pages** - Frontend website pages (Content group)
- **Media** - File uploads (Content group)
- **FaceIt Seasons** - Auto-managed through Teams (Production group)

---

## Design Notes

### Group Icons (Future Enhancement)
Consider adding emoji/icon prefixes to group headers:
- 👥 PEOPLE
- 🎬 PRODUCTION
- 🎙️ STAFF
- 📱 SOCIAL MEDIA
- 📋 RECRUITMENT
- ⚙️ SYSTEM

### Naming Conventions
- **Singular/Plural:** Collections use proper plural names
- **Clarity:** Names describe what's inside (not technical jargon)
- **Consistency:** Similar items have similar naming patterns

### Ordering Logic
Within each group, items are ordered by:
1. **Frequency of use** (most used first)
2. **Workflow** (logical order of operations)
3. **Alphabetical** (when no clear priority)

---

## Recommended Future Improvements

### 1. Add Breadcrumbs
Show current location path on list/edit pages:
```
Dashboard > Production > Matches > Edit Match
```

### 2. Recent Items
Add a "Recently Viewed" section at top of sidebar for quick access.

### 3. Search Collections
Quick search bar at top of sidebar to filter visible collections.

### 4. Collapsible Groups
Allow users to collapse rarely-used groups to reduce scrolling.

### 5. Role-Based Ordering
Show most relevant groups first based on user's role:
- Production Staff → Production group at top
- Social Media Manager → Social Media at top

---

## Access Control Summary

| Group | Admin | Manager | Team Manager | Production Staff | Social Media |
|-------|-------|---------|--------------|------------------|--------------|
| **People** | Full | Full | Teams only | Read only | Hidden |
| **Production** | Full | Full | Hidden | Dashboard + Matches | Hidden |
| **Staff** | Full | Full | Hidden | Hidden | Hidden |
| **Social Media** | Full | Full | Hidden | Hidden | Full |
| **Recruitment** | Full | Full | Listings only | Hidden | Hidden |
| **System** | Full | Users only | Hidden | Hidden | Hidden |

---

## Changelog

### December 29, 2025 (Afternoon)
- ✅ **Reordered sidebar groups** for better workflow:
  - PEOPLE (foundation) → STAFF (management) → PRODUCTION (dept) → SOCIAL MEDIA (dept) → RECRUITMENT (growth) → SYSTEM (admin)
- ✅ **Moved FaceIt Leagues** from PRODUCTION to PEOPLE
  - Rationale: It's team/competition metadata, not broadcast operations
  - Selected on team pages, displays on team frontend
  - Admins manage leagues, teams join them, production uses the data

### December 29, 2025 (Morning)
- ✅ Removed duplicate logout button (used Payload's built-in)
- ✅ Confirmed FaceIt spelling is correct (capital I)
- ✅ Moved "Data Consistency" from Tools to System
- ✅ Eliminated empty "Tools" category

### December 21, 2025
- Created FaceIt Leagues collection
- Added FaceIt integration to Teams
- Reorganized sidebar groups

### November 2025
- Initial sidebar structure with 6 main groups
- Added custom Dashboard link at top

