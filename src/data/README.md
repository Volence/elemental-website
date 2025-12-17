# Teams Data

This directory contains the JSON file for all team information.

## File: `teams.json`

This file contains all team data for Elemental. Edit this file to update team rosters, staff, achievements, and other information.

## Structure

Each team object can have the following fields:

```json
{
  "slug": "team-name",           // URL-friendly identifier (required)
  "name": "Team Name",            // Display name (required)
  "logo": "/logos/elmt_xxx.png", // Path to logo image (required)
  "region": "NA",                 // Region: "NA" or "EU" (optional)
  "rating": "4.5K",              // Skill rating or tier (optional)
  "achievements": [              // Array of achievement strings (optional)
    "Faceit S5 Advanced Champions"
  ],
  "manager": ["@Username"],      // Array of manager usernames (optional)
  "coaches": ["@Username"],       // Array of coach usernames (optional)
  "captain": ["@Username"],       // Array of captain usernames (optional)
  "coCaptain": "@Username",      // Single co-captain username (optional, null if none)
  "roster": [                     // Array of player objects (optional)
    {
      "name": "@PlayerName",
      "role": "tank"              // Role: "tank", "dps", or "support"
    }
  ],
  "subs": [                       // Array of substitute player usernames (optional)
    "@SubPlayer"
  ]
}
```

## Player Roles

- `"tank"` - Tank role (shield icon)
- `"dps"` - Damage role (swords icon)
- `"support"` - Support role (heart icon)

## Examples

### Minimal Team (logo only)
```json
{
  "slug": "cosmic",
  "name": "Cosmic",
  "logo": "/logos/elmt_cosmic.png"
}
```

### Full Team with Roster
```json
{
  "slug": "fire",
  "name": "Fire",
  "logo": "/logos/elmt_fire.png",
  "region": "EU",
  "rating": "4.5K",
  "manager": ["@Hades"],
  "coaches": [],
  "captain": ["@Buzzj23", "@Shibal"],
  "roster": [
    { "name": "@Shibal", "role": "tank" },
    { "name": "@Mattie", "role": "dps" },
    { "name": "@palloz", "role": "dps" },
    { "name": "@Buzzj23", "role": "support" },
    { "name": "@Bap demon", "role": "support" }
  ],
  "subs": [
    "@malumcrypt",
    "@MadBern (edited)"
  ]
}
```

## Editing Tips

1. **Always keep the JSON valid** - Make sure all brackets, braces, and quotes are properly closed
2. **Use arrays for multiple values** - For managers, coaches, captains, use arrays even if there's only one
3. **Keep slugs lowercase** - Use lowercase letters and hyphens (e.g., "team-name")
4. **Logo paths** - All logos should be in `/public/logos/` and referenced as `/logos/filename.png`
5. **Save and refresh** - After editing, save the file and refresh your browser to see changes

## Adding New Teams

1. Add a new object to the `teams` array
2. Include at minimum: `slug`, `name`, and `logo`
3. Add roster and staff information as needed
4. Ensure the logo file exists in `/public/logos/`

## Updating Existing Teams

1. Find the team object by its `slug`
2. Update any fields as needed
3. Save the file
4. Changes will appear immediately on the website

