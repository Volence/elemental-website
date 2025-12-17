# Migration Guide: Name-Based to People Relationships

This guide explains how to migrate from the old name-based system to the new People relationships system.

## Overview

The new system uses a unified **People** collection as the single source of truth for all people (players, staff, casters, etc.). All other collections (Teams, OrganizationStaff, Production) can link to People via relationships.

### Benefits

- ✅ **Single source of truth** - Update a person once, reflects everywhere
- ✅ **No name matching issues** - Relationships eliminate typos and inconsistencies
- ✅ **Better data integrity** - Centralized social links and profile information
- ✅ **Easier management** - See all of a person's roles in one place

## Migration Steps

### Step 1: Create People Entries

1. Go to **People** collection in admin panel
2. Create entries for all your players and staff
3. Add their social links and any profile information
4. The system will warn you about similar names to help avoid duplicates

### Step 2: Link People in Collections

**Option A: Manual Linking (Recommended for small datasets)**
1. Edit each team/staff entry
2. Use the **Person** field to link to the People collection
3. The name field will auto-fill from the linked person
4. Social links will also be merged automatically

**Option B: Automatic Migration (For large datasets)**
1. Make sure all people exist in the People collection
2. Call the migration endpoint: `POST /api/migrate-to-people`
3. This will automatically create People entries and link them

### Step 3: Verify and Clean Up

1. Check that all names are correctly linked
2. Remove any duplicate People entries
3. Update any remaining legacy name fields to use Person relationships

## Backward Compatibility

The system supports **both** the old name-based system and new People relationships:

- ✅ Legacy name fields still work
- ✅ Frontend code handles both formats
- ✅ You can migrate gradually - no need to do everything at once

## Bulk Operations

### Finding Similar Names

```typescript
import { findSimilarPeople } from '@/utilities/bulkPeopleOperations'

const similar = await findSimilarPeople('John Doe', 0.8)
// Returns people with names similar to "John Doe"
```

### Merging Duplicate People

```typescript
import { mergePeople } from '@/utilities/bulkPeopleOperations'

// Merge person IDs 2, 3, 4 into person ID 1
await mergePeople(1, [2, 3, 4])
// All references to people 2, 3, 4 will be updated to point to person 1
// People 2, 3, 4 will be deleted
```

### Exporting People Data

```typescript
import { exportPeopleData } from '@/utilities/bulkPeopleOperations'

const data = await exportPeopleData()
// Returns array of all people data for backup
```

## API Endpoints

### Migration Endpoint

**POST** `/api/migrate-to-people`

Automatically migrates all name-based entries to People relationships.

**Response:**
```json
{
  "success": true,
  "message": "Migration completed",
  "results": {
    "teamsUpdated": 25,
    "orgStaffUpdated": 10,
    "productionStaffUpdated": 5,
    "errors": []
  }
}
```

## Best Practices

1. **Create People First**: Always create People entries before linking them
2. **Use Person Field**: Prefer Person relationships over name fields
3. **Check for Duplicates**: Use `findSimilarPeople` before creating new entries
4. **Merge Carefully**: Review duplicates before merging
5. **Backup First**: Export data before running bulk operations

## Troubleshooting

### Person field not showing
- Make sure People collection exists and is in payload.config.ts
- Restart the application

### Names not auto-filling
- Check that the Person relationship is properly populated (depth: 1)
- Verify the hooks are running (check server logs)

### Migration errors
- Check that all people exist in People collection first
- Review error messages in the migration response
- Some entries may need manual linking

## Future Improvements

- Admin UI for bulk operations
- Duplicate detection warnings in admin panel
- Auto-suggest existing people when typing names
- Visual indicators for linked vs. unlinked entries
