# Admin Panel Structure & Organization

This document outlines the current admin panel structure and the new People system.

## Current Collections

### Content Group
- **Pages** - Website pages with rich content, blocks, and SEO
- **Media** - Images, videos, and other media files

### People Group
- **People** - ✨ NEW: Unified collection for all people (players, staff, casters, etc.). Single source of truth for person profiles.

### Esports Group
- **Teams** - Competitive teams with rosters, staff, and achievements
- **Matches** - Competitive matches with teams, scores, streams, and VODs

### Staff Group
- **Organization Staff** - Owners, HR, moderators, managers (org-level roles)
- **Production Staff** - Casters, observers, producers (broadcast roles)

### System Group
- **Users** - Admin users for CMS access (not players/staff)

## Current Structure: Hybrid System (People Relationships + Legacy Names)

### How It Works

**✨ New System (Recommended):**
- Create people in the **People** collection first
- Link them in teams/staff collections using the **Person** relationship field
- Names and social links auto-fill from People when linked
- Update once in People, reflects everywhere

**Legacy System (Still Supported):**
- Players and staff can still be stored as **name strings** in arrays
- The system uses **case-insensitive name matching** to link people across collections
- Social links can be added in multiple places and are merged on player pages
- Both systems work together - frontend handles both formats

### Where People Appear
1. **Teams Collection**
   - Roster players (with role: tank/dps/support)
   - Substitute players
   - Managers
   - Coaches
   - Captains
   - Co-captains

2. **Organization Staff Collection**
   - Owners, Co-Owners
   - HR, Moderators
   - Event Managers, Social Managers
   - Graphics, Media Editors

3. **Production Staff Collection**
   - Casters
   - Observers
   - Producers
   - Combined roles (Observer/Producer, etc.)

4. **Matches Collection**
   - Linked to Production Staff as casters/producers/observers

### Important Notes

⚠️ **Name Consistency is Critical**
- Names must match exactly (case-insensitive) across all collections
- If "John Doe" is a player on Team A and a manager on Team B, use the exact same spelling
- Typos or variations will create separate player pages

⚠️ **Social Links**
- Social links can be added in multiple places (team roster, staff collections)
- They are automatically merged on player pages
- Update social links in all places where a person appears for consistency

⚠️ **Updating Names**
- When updating a person's name, you must update it everywhere they appear:
  - All team rosters they're on
  - All team staff positions (manager, coach, captain)
  - Organization Staff collection (if applicable)
  - Production Staff collection (if applicable)

## ✨ New Features Implemented

### 1. Unified People Collection ✅

**Implemented**: A unified `People` collection is now available:
- Single source of truth for each person
- Centralized social links
- Profile information (bio, photo, notes)
- All teams/staff collections can reference this collection via relationships

**Benefits**:
- No more name matching issues
- Update once, reflects everywhere
- Better data integrity
- Easier to manage

**Usage**:
1. Create people in the **People** collection first
2. Link them in teams/staff using the **Person** field
3. Names and social links auto-fill automatically

### 2. Data Validation ✅

**Implemented**:
- Auto-fill names from People relationships
- Similar name detection (warns about potential duplicates in People collection)
- Automatic social link merging from People

### 3. Bulk Operations ✅

**Implemented**:
- `findSimilarPeople()` - Find people with similar names
- `mergePeople()` - Merge duplicate people and update all references
- `exportPeopleData()` - Export all people data for backup
- Migration endpoint: `POST /api/migrate-to-people` - Auto-migrate existing data

See `MIGRATION_GUIDE.md` for details.

### 4. Better Admin Organization ✅

✅ **Already Implemented**:
- Collections grouped into logical categories (Content, People, Esports, Staff, System)
- Helpful descriptions on all collections
- Field descriptions explaining usage
- BeforeDashboard component with guidance
- Conditional fields (legacy fields hide when Person is set)

## Best Practices

### Adding a New Person (Recommended Workflow)
1. **Create in People collection first**: Go to People → Create New
2. **Add profile info**: Name, social links, bio, photo
3. **Link in teams/staff**: Use the Person field to link them
4. **Names auto-fill**: The name field will automatically populate from People

### Adding a New Person (Legacy Workflow)
1. **Check if they already exist**: Search existing teams/staff collections or People collection
2. **Use consistent naming**: Decide on a format (e.g., "Display Name" or "@username")
3. **Add social links**: Add them in the primary place they appear (usually team roster)
4. **Consider migrating**: Use the migration endpoint to convert to People relationships later

### Updating a Person's Name

**If using People relationships:**
1. **Update in People collection**: Change the name once
2. **Auto-updates everywhere**: All linked entries will use the new name

**If using legacy names:**
1. **Search everywhere**: Check all teams, org staff, and production staff
2. **Update all occurrences**: Change the name in every place they appear
3. **Test player page**: Verify the player page still works correctly
4. **Consider migrating**: Link to People collection to avoid this in the future

### Managing Overlapping Roles
- If someone is both a player and manager: Add them to both roster and manager fields (or link the same Person in both)
- If someone is both org staff and production: Add them to both collections (or link the same Person in both)
- The system will automatically merge roles on their player page

## Admin Panel Tips

- **Use the search**: Search for people before adding them to avoid duplicates
- **Check field descriptions**: Each field has helpful descriptions explaining usage
- **Use tabs in Teams**: The Teams collection uses tabs to organize information
- **Preview changes**: Use the preview links in BeforeDashboard to see changes live
