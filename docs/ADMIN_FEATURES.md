# Admin Panel Features

## 📊 Data Consistency Dashboard

### Quick Summary (Dashboard)
- **Location**: Main dashboard page (`/admin`)
- **Visibility**: All authenticated users
- **Shows**: 
  - Count of critical errors and warnings
  - Brief summary of issue categories
  - Total items affected
  - Link to detailed report (Admin-only)

### Detailed Report (Full Page)
- **Location**: `/data-consistency` (opens in new tab from admin sidebar)
- **Visibility**: **Admins only** (client-side role check)
- **Technical Note**: Due to Payload CMS 3.0's routing architecture, custom admin pages at `/admin/*` URLs must go through the catch-all route system. To avoid conflicts and provide a better user experience, this page is served at `/data-consistency` and opens in a new tab when accessed from the admin sidebar link.
- **Features**: Full detailed report with all affected items listed, auto-fix functionality, and dark mode support.
- **Features**:
  - ✅ Full list of all affected items with IDs, names, and slugs
  - ✅ Detailed breakdown by issue category
  - ✅ Scrollable tables showing every affected item
  - ✅ "Fix All Auto-Fixable Issues" button
  - ✅ Color-coded severity (red for errors, orange for warnings)
  - ✅ Auto-fixable badge for issues that can be resolved automatically

### Issue Types Detected
1. **Broken Relationships** (Auto-fixable)
   - Teams referencing deleted People records
   - Shows which teams are affected and how many broken refs each has

2. **Unassigned People** (Manual fix needed)
   - People not assigned to any team
   - Shows full list with IDs, names, and slugs

3. **Incomplete Rosters** (Manual fix needed)
   - Teams with less than 5 players
   - Shows roster count and recommended minimum

4. **Duplicate Names** (Manual fix needed)
   - Similar person names that might be duplicates
   - Groups duplicates together for review

## 📝 Activity Log (Currently Disabled)

### Status
- **Status**: ⚠️ Temporarily disabled due to database migration issues
- **Reason**: PostgreSQL schema migration for system tables requires manual intervention
- **Expected Location**: `System → Activity Logs` (when enabled)

### What It Would Track
- All create/update/delete operations
- User who performed the action
- Timestamp and IP address
- JSON diff of changes
- Affected collections: Teams, People, Users, Matches

### To Re-enable
Requires manual database migration:
1. Add `activity_log_id` column to `payload_locked_documents_rels` table
2. Create `activity_log` table with proper schema
3. Uncomment ActivityLog collection in `payload.config.ts`
4. Uncomment activity log hooks in collection files

## 🎯 Quick Access Features

### Assigned Teams Widget
- **Location**: Dashboard and Teams list page
- **Visibility**: Admins, Staff Managers, Team Managers
- **Features**:
  - Shows your assigned teams as clickable cards
  - Team logos displayed next to names
  - Larger touch targets for mobile
  - Direct links to team edit pages

### Team List Improvements
- **Logo Preview**: Shows team logo in list (fallback to org logo)
- **Centered Content**: All columns vertically centered, including checkboxes
- **Reduced Row Height**: From 60px to 50px for better density
- **Custom Cells**: Region labels, formatted timestamps, ratings

### Breadcrumbs Enhancement
- Uses organization logo instead of emoji
- Shows collection icons in descriptions

## 🔐 Access Control

### Role-Based Access
- **Admin**: Full access to everything + Data Consistency detailed page
- **Staff Manager**: Assigned teams quick access, read-only for other teams
- **Team Manager**: Assigned teams full access, read-only for other teams
- **User**: Read-only access to public content

### Team Assignment
- Admins and Staff/Team Managers can be assigned specific teams
- Shows up in "Your Assigned Teams" widget for quick access
- Edit in User profile → Assigned Teams field

## 📂 File Locations

### Components
- Dashboard Widget: `/src/components/BeforeDashboard/DataConsistencyDashboard/index.tsx`
- Detailed View: `/src/views/DataConsistencyView.tsx` (registered as custom admin view)
- Team Logo Cells: `/src/components/TeamsListColumns/*.tsx`
- Assigned Teams: `/src/components/BeforeDashboard/AssignedTeams*.tsx`

### API Endpoints
- Check Issues: `/src/app/api/data-consistency-check/route.ts`
- Fix Issues: `/src/app/api/fix-data-issues/route.ts`

### Collections
- Teams: `/src/collections/Teams/index.ts`
- People: `/src/collections/People/index.ts`
- Users: `/src/collections/Users/index.ts`
- ActivityLog (disabled): `/src/collections/ActivityLog.ts`

## 🚀 Usage Tips

### For Admins
1. Check dashboard daily for data consistency issues
2. Click "View Detailed Report" to see exactly what's affected
3. Review the detailed list before clicking "Fix All"
4. Broken relationships are auto-fixable, but review the list first
5. Manual issues (unassigned people, duplicates) require individual review

### For Team Managers
1. Use "Your Assigned Teams" widget for quick access
2. Check team rosters regularly for completeness
3. Ensure all people are properly assigned to positions

### For Staff Managers
1. Monitor multiple teams via assigned teams widget
2. Review data consistency warnings for teams you manage
3. Coordinate with admins for fixing critical errors

## 🔧 Maintenance

### Regular Tasks
- **Daily**: Check data consistency dashboard
- **Weekly**: Review unassigned people
- **Monthly**: Check for duplicate names, clean up old data

### Troubleshooting
- If data consistency page doesn't load: Check admin role permissions
- If issues don't auto-fix: Check console for error messages
- If logos don't show: Verify `/public/logos/org.png` exists
