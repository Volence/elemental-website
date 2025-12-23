# User Invite System Guide

## Overview

The Elemental website now has a comprehensive invite-based user onboarding system that allows admins to generate secure invite links with pre-configured permissions. Users can sign up using these links and manage their own passwords.

## Features

### For Admins

1. **Generate Invite Links**
   - Navigate to **Invite Links** in the admin sidebar (under System)
   - Click "Create New"
   - Configure:
     - **Role**: Admin, Team Manager, or Staff Manager
     - **Assigned Teams**: Select which teams the user will have access to
     - **Email** (optional): Pre-fill an email address
     - **Expiration**: Automatically set to 7 days from creation
   - Click "Create"
   - Copy the generated invite link using the "Copy Link" button

2. **Manage Invite Links**
   - View all invite links with status indicators:
     - **Active** (green): Link is valid and unused
     - **Expired** (red): Link has passed expiration date
     - **Used** (gray): Link has been consumed
   - Track who created each invite and when
   - See who used each invite (after signup)

3. **Invite Link Security**
   - Each link uses a cryptographically random UUID token
   - Links expire after 7 days OR when used (whichever comes first)
   - Cannot be reused once consumed
   - Only admins can create, view, or manage invite links

### For New Users

1. **Signing Up**
   - Receive invite link from an admin (e.g., `https://elmt.gg/invite/abc123-def456-...`)
   - Click the link to open the signup page
   - Fill in the form:
     - **Full Name**: Your display name
     - **Email**: Your email address (may be pre-filled)
     - **Password**: Must be at least 8 characters
     - **Confirm Password**: Must match password
   - Click "Create Account"
   - Automatically logged in and redirected to admin panel

2. **What Happens**
   - Your account is created with the role and team access specified in the invite
   - The invite link is marked as "used" and cannot be used again
   - You receive full access to the admin panel based on your role

### For All Users

1. **Changing Your Password**
   - Navigate to **My Profile** in the admin sidebar (under System)
   - Scroll to "Change Password" section
   - Enter:
     - **Current Password**: Your existing password
     - **New Password**: Must be at least 8 characters
     - **Confirm New Password**: Must match new password
   - Click "Update Password"
   - Your password is immediately updated

2. **Account Security**
   - Passwords are hashed using bcrypt (industry standard)
   - Only you can change your password (admins cannot see it)
   - If you forget your password, contact an admin for a new invite link

## Technical Details

### Database Tables

**invite_links**
- `id`: Primary key
- `token`: Unique UUID for the invite link
- `role`: User role (admin, team-manager, staff-manager)
- `email`: Optional pre-filled email
- `expires_at`: When the invite expires (7 days from creation)
- `used_at`: When the invite was used (null if unused)
- `used_by_id`: Foreign key to users table
- `created_by_id`: Foreign key to users table (who created the invite)
- `created_at`, `updated_at`: Timestamps

**invite_links_assigned_teams** (join table)
- Links invite_links to teams for assigned team access

### API Endpoints

**POST /api/invite/signup**
- Public endpoint for processing invite signups
- Validates:
  - Token exists and is valid
  - Token not expired
  - Token not already used
  - Email is unique
  - Password meets requirements
- Creates user account
- Marks invite as used
- Logs user in automatically

### Access Control

**Invite Links Collection**
- Create: Admin only
- Read: Admin only
- Update: Admin only
- Delete: Admin only

**Users Collection**
- Create: Admin only (or via invite signup)
- Read: Admins can read all; users can read themselves
- Update: Admins can update all; users can update themselves (name, email, password only)
- Delete: Admin only

**User Profile Global**
- Read: All authenticated users
- Update: Not applicable (UI-only global)

### Security Considerations

1. **Token Generation**: Uses UUID v4 (cryptographically random)
2. **Expiration**: 7-day limit prevents long-term exposure
3. **Single-Use**: Tokens cannot be reused after signup
4. **Email Uniqueness**: Enforced at database level
5. **Password Hashing**: Bcrypt with salt (handled by Payload)
6. **Self-Update Restrictions**: Users cannot change their role or assigned teams

## User Flows

### Admin Creating an Invite

```
Admin logs in
  → Navigates to Invite Links
  → Clicks "Create New"
  → Selects role: "Team Manager"
  → Selects teams: ["ELMT Water", "ELMT Garden"]
  → (Optional) Enters email: "newmanager@example.com"
  → Clicks "Create"
  → System generates UUID token
  → System sets expiration to 7 days from now
  → Admin copies invite link
  → Admin sends link to new user (email, Slack, etc.)
```

### New User Signing Up

```
User receives invite link
  → Clicks link
  → System validates token (exists, not expired, not used)
  → User sees signup form
  → User fills in name, email, password
  → User submits form
  → System validates all fields
  → System checks email uniqueness
  → System creates user account with role and teams from invite
  → System marks invite as "used"
  → System logs user in
  → User redirected to admin dashboard
```

### User Changing Password

```
User logs in
  → Navigates to "My Profile"
  → Enters current password
  → Enters new password (min 8 chars)
  → Confirms new password
  → Clicks "Update Password"
  → System verifies current password
  → System updates password (hashed)
  → User sees success message
  → Password immediately active
```

## Troubleshooting

### "Invalid Invite Link"
- The token doesn't exist in the database
- Check that the URL is correct and complete
- Contact the admin who sent the link

### "Invite Already Used"
- This link was already used to create an account
- Contact an admin for a new invite link

### "Invite Expired"
- The link is older than 7 days
- Contact an admin for a new invite link

### "Email Already Exists"
- An account with this email already exists
- Try logging in instead
- Contact an admin if you've forgotten your password

### "Current Password Incorrect"
- The password you entered doesn't match your current password
- Double-check for typos
- If forgotten, contact an admin for a new invite link (you'll need to create a new account)

## Best Practices

### For Admins

1. **Generate Fresh Links**: Don't reuse old invite links
2. **Set Appropriate Roles**: Only give users the access they need
3. **Track Usage**: Regularly check which invites have been used
4. **Clean Up**: Periodically delete old expired/used invites
5. **Secure Distribution**: Send invite links through secure channels (not public)

### For Users

1. **Strong Passwords**: Use at least 12 characters with mixed case, numbers, symbols
2. **Unique Passwords**: Don't reuse passwords from other sites
3. **Change Regularly**: Update your password every 90 days
4. **Keep Secure**: Don't share your password with anyone
5. **Log Out**: Always log out when using shared computers

## Future Enhancements (Potential)

- Email notifications when invites are used
- Bulk invite generation
- Custom expiration periods
- Invite templates for common roles
- Password reset via email (currently requires new invite)
- Two-factor authentication
- Password strength meter on signup
- Account activity logs

## Migration Information

**Migration File**: `src/migrations/20251223_141330_add_invite_links.ts`

This migration creates:
- `invite_links` table with all fields and indexes
- `invite_links_assigned_teams` join table
- Foreign key constraints to `users` and `teams` tables
- Indexes on `token` (unique), `expires_at`, `used_at` for performance

The migration runs automatically when the Payload server starts with `PAYLOAD_DB_PUSH=true` or when manually triggered.

## Code Locations

- **Collection**: `src/collections/InviteLinks/index.ts`
- **Global**: `src/globals/UserProfile.ts`
- **Components**:
  - `src/components/InviteLinkFields/CopyLinkField.tsx`
  - `src/components/InviteLinkColumns/StatusCell.tsx`
  - `src/components/UserProfile/index.tsx`
  - `src/app/(frontend)/invite/[token]/components/SignupForm.tsx`
- **Pages**:
  - `src/app/(frontend)/invite/[token]/page.tsx`
- **API**:
  - `src/app/api/invite/signup/route.ts`
- **Migration**: `src/migrations/20251223_141330_add_invite_links.ts`

## Dependencies

- `uuid`: For generating cryptographically random tokens
- `@types/uuid`: TypeScript types for uuid

