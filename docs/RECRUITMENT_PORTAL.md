# Recruitment Portal - Implementation Complete

## Overview

A complete recruitment portal system has been implemented allowing team managers to post open player positions, applicants to apply through a public form, and managers to review applications with a full status workflow in the admin panel.

## Features Implemented

### ✅ Backend Collections

#### 1. RecruitmentListings Collection
**Location:** `src/collections/RecruitmentListings/index.ts`

- **Fields:**
  - `team` - Relationship to Teams collection
  - `role` - Select (Tank, DPS, Support)
  - `requirements` - Textarea (what they're looking for)
  - `status` - Select (Open, Filled, Closed)
  - `filledBy` - Relationship to People (auto-set when filled)
  - `createdBy` - Relationship to Users (who posted it)
  - `applicationCount` - Virtual field counting applications

- **Access Control:**
  - Read: Anyone (public)
  - Create: Team Managers, Staff Managers, Admins
  - Update: Creator, assigned team managers, admins
  - Delete: Admins only

#### 2. RecruitmentApplications Collection
**Location:** `src/collections/RecruitmentApplications/index.ts`

- **Fields:**
  - `listing` - Relationship to RecruitmentListings
  - `discordHandle` - Text (required)
  - `aboutMe` - Textarea (required)
  - `status` - Select (New, Reviewing, Contacted, Tryout, Accepted, Rejected)
  - `internalNotes` - Textarea (manager-only)
  - `archived` - Boolean (hide old applications)

- **Access Control:**
  - Read: Team managers see only their team's apps, admins see all
  - Create: Public API endpoint only
  - Update: Team managers (for their teams), admins
  - Delete: Admins only

### ✅ Public API

**Endpoint:** `POST /api/recruitment/apply`
**Location:** `src/app/api/recruitment/apply/route.ts`

- Public endpoint (no authentication required)
- Validates listing is still open
- Rate limiting: 1 application per IP per listing per 24 hours
- Creates application with status "New"
- Returns success/error messages

### ✅ Frontend Pages

#### 1. Public Recruitment Page
**Location:** `src/app/(frontend)/recruitment/page.tsx`

- Lists all open positions grouped by team
- Shows team logos, roles, and requirements
- "Apply Now" button opens modal
- Responsive card-based layout

#### 2. Recruitment Card Component
**Location:** `src/app/(frontend)/recruitment/components/RecruitmentCard.tsx`

- Displays individual listing
- Role-specific color coding (Tank: blue, DPS: red, Support: green)
- Opens application modal on click

#### 3. Application Modal
**Location:** `src/app/(frontend)/recruitment/components/ApplicationModal.tsx`

- Form with Discord handle and About Me fields
- Client-side validation
- Submits to API endpoint
- Success message with auto-close
- Error handling

#### 4. Team Page Integration
**Location:** `src/app/(frontend)/teams/[slug]/page.tsx` + `components/TeamRecruitmentSection.tsx`

- Shows open positions on team detail pages
- Highlighted section with yellow accent
- Only renders if team has open listings
- Apply button opens modal

### ✅ Admin Panel Features

#### 1. Dashboard Widget
**Location:** `src/components/BeforeDashboard/RecruitmentWidget/index.tsx`

- Shows counts of:
  - New applications (highlighted if > 0)
  - Open positions
  - Total applications
- Quick links to review applications and manage listings
- Visible to Team Managers, Staff Managers, and Admins

#### 2. Custom List Columns
**Location:** `src/components/RecruitmentListColumns/`

- **TeamCell.tsx** - Displays team name in listings list
- **RoleCell.tsx** - Displays role with color-coded badge
- **ListingCell.tsx** - Shows "Team - Role" in applications list

### ✅ Automation

#### Auto-Close Hook
**Location:** `src/collections/People/hooks/autoCloseRecruitment.ts`

- Runs after a Person is created/updated
- Checks if person is assigned to a team with a role
- Finds matching open listings for that team + role
- Auto-closes listings and sets `filledBy` field
- Logs closure for tracking

**Integrated in:** `src/collections/People/index.ts` (afterChange hook)

### ✅ Utilities

**Location:** `src/utilities/recruitmentHelpers.ts`

- `canManageListing()` - Check if user can edit a listing
- `canViewApplications()` - Check if user can see applications for a team
- `isListingOpen()` - Check if listing accepts applications

### ✅ Styling

#### Admin Panel Styles
**Location:** `src/app/(payload)/styles/components/_recruitment.scss`

- `.recruitment-widget` - Dashboard widget styling
- `.recruitment-widget--highlight` - Pulsing glow for new apps
- `.recruitment-status-badge` - Color-coded status badges
- `.list-cell` - List column styling
- Color-coded roles and statuses

**Imported in:** `src/app/(payload)/styles/admin.scss`

#### Frontend Styles
Uses existing Tailwind classes from `globals.css` for consistency with Teams page

## Workflow

### For Team Managers

1. **Create a Listing:**
   - Go to Recruitment Listings collection
   - Click "Create New"
   - Select team, role, enter requirements
   - Status defaults to "Open"
   - Listing appears on public page and team page

2. **Review Applications:**
   - Dashboard shows count of new applications
   - Click "Review Applications" or go to Recruitment Applications collection
   - See only applications for assigned teams
   - Update status as you review (New → Reviewing → Contacted → Tryout → Accepted/Rejected)
   - Add internal notes for tracking

3. **Fill Position:**
   - Option A: Manually close listing (change status to "Filled")
   - Option B: Add person to team roster (auto-closes listing via hook)

### For Applicants

1. Visit `/recruitment` page or team page
2. Click "Apply Now" on a position
3. Fill in Discord handle and About Me
4. Submit application
5. Receive confirmation message

### For Admins

- Full access to all listings and applications
- Can create/edit/delete any listing
- Can see and manage all applications
- Dashboard shows system-wide stats

## Files Created (15)

### Collections (2)
- `src/collections/RecruitmentListings/index.ts`
- `src/collections/RecruitmentApplications/index.ts`

### Components (6)
- `src/components/RecruitmentListColumns/TeamCell.tsx`
- `src/components/RecruitmentListColumns/RoleCell.tsx`
- `src/components/RecruitmentListColumns/ListingCell.tsx`
- `src/components/BeforeDashboard/RecruitmentWidget/index.tsx`
- `src/app/(frontend)/recruitment/components/RecruitmentCard.tsx`
- `src/app/(frontend)/recruitment/components/ApplicationModal.tsx`

### Pages (2)
- `src/app/(frontend)/recruitment/page.tsx`
- `src/app/(frontend)/teams/[slug]/components/TeamRecruitmentSection.tsx`

### API (1)
- `src/app/api/recruitment/apply/route.ts`

### Utilities & Hooks (2)
- `src/utilities/recruitmentHelpers.ts`
- `src/collections/People/hooks/autoCloseRecruitment.ts`

### Styles (1)
- `src/app/(payload)/styles/components/_recruitment.scss`

### Documentation (1)
- `docs/RECRUITMENT_PORTAL.md` (this file)

## Files Modified (8)

1. `src/payload.config.ts` - Registered new collections
2. `src/collections/People/index.ts` - Added autoCloseRecruitment hook
3. `src/app/(frontend)/teams/[slug]/page.tsx` - Added recruitment section
4. `src/components/BeforeDashboard/index.tsx` - Added RecruitmentWidget
5. `src/app/(payload)/styles/admin.scss` - Imported recruitment styles

## Testing Checklist

### Backend
- [ ] Collections appear in admin panel sidebar (under "Recruitment" group)
- [ ] Team managers can create listings for their assigned teams
- [ ] Admins can create listings for any team
- [ ] Application count displays correctly on listings
- [ ] Access control works (managers see only their team's apps)

### Public API
- [ ] Can submit application to open listing
- [ ] Rate limiting prevents duplicate submissions (24 hour window)
- [ ] Validation works (Discord handle, aboutMe length)
- [ ] Cannot apply to closed/filled listings

### Frontend
- [ ] `/recruitment` page lists all open positions
- [ ] Listings grouped by team
- [ ] Application modal opens and closes correctly
- [ ] Form validation works
- [ ] Success message displays after submission
- [ ] Team pages show recruitment section when positions are open

### Admin Dashboard
- [ ] Recruitment widget appears for team managers and admins
- [ ] New applications count is accurate
- [ ] Widget highlights when new applications exist
- [ ] Links to applications and listings work

### Automation
- [ ] Adding person to team roster auto-closes matching listing
- [ ] `filledBy` field is set correctly
- [ ] Multiple listings can exist for same team (different roles)

### Styling
- [ ] Dashboard widget matches admin panel theme
- [ ] Status badges display with correct colors
- [ ] Frontend cards are responsive
- [ ] Modal is accessible and functional on mobile

## Usage Examples

### Creating a Listing (Admin Panel)

1. Navigate to Recruitment Listings
2. Click "Create New"
3. Select Team: "Water"
4. Select Role: "Support"
5. Enter Requirements: "We're looking for a Main Support. Must have a good attitude and can scrim 3 times a week."
6. Save (status defaults to "Open")

### Applying (Public)

1. Visit `https://yourdomain.com/recruitment`
2. Find Water team's Support listing
3. Click "Apply Now"
4. Enter Discord handle: "player123"
5. Enter About Me: "I'm a Support main with 2 years experience. I can scrim Mon/Wed/Fri evenings."
6. Click "Submit Application"

### Reviewing Applications (Admin Panel)

1. Dashboard shows "3 New Applications"
2. Click "Review Applications"
3. Click on an application to open it
4. Read details, check Discord handle
5. Change status to "Contacted"
6. Add internal notes: "Messaged on Discord, scheduling tryout for Friday"

### Filling Position (Auto-Close)

1. Navigate to People collection
2. Create or edit person who was selected
3. Ensure they're linked to team with appropriate role
4. Hook automatically closes matching open listing

## Future Enhancements (Not Implemented)

- Email notifications when applications are received
- Discord webhook integration for auto-posting
- Application rating/scoring system
- Bulk actions on applications
- Public application count display ("5 applicants")
- Direct messaging from admin panel
- Application history/timeline
- Export applications to CSV

## Migration Notes

**Database Schema Changes:**
- Two new collections will be created on next build/migration
- No impact on existing data
- Safe to deploy

**Breaking Changes:**
- None

**Rollback:**
- Remove collections from `payload.config.ts`
- Delete collection files
- Remove hook from People collection
- Remove widget from BeforeDashboard

## Support

For issues or questions:
1. Check collection field descriptions in admin panel
2. Review access control rules in collection configs
3. Check browser console for API errors
4. Verify user roles and team assignments

---

**Implementation Date:** December 22, 2025  
**Status:** ✅ Complete  
**Estimated Implementation Time:** 4-6 hours  
**Files Created:** 15  
**Files Modified:** 5  

