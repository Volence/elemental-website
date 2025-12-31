# Admin Monitoring & Security Suite

**Last Updated:** December 30, 2025

## Overview

The Admin Monitoring & Security Suite provides comprehensive tracking and monitoring capabilities for the Elemental admin panel. This system helps administrators monitor user actions, track scheduled jobs, capture errors, view active sessions, and check database health.

**Access:** Admin-only (requires `admin` role)

## Features

### 1. Audit Log 🔍

**Location:** `/admin/globals/audit-log-viewer`

Track user actions for security and compliance monitoring.

#### What's Tracked

- **Login/Logout Events** - User authentication tracking
- **Create Operations** - New records in teams, matches, people, users
- **Delete Operations** - Deleted records with details
- **Update Operations** - Changes to critical records
- **Bulk Operations** - Data consistency changes, imports

#### Logged Information

- User who performed the action
- Action type (login, logout, create, delete, update, bulk)
- Collection affected
- Document ID and title
- Additional metadata (role changes, bulk operation details)
- IP address
- Timestamp

#### How to Use

1. Navigate to **Monitoring > Audit Log** in the sidebar
2. Use the filter dropdown to view specific action types
3. Click on timeline entries to expand details
4. Use pagination to browse historical logs

#### Integration Points

Audit logging is automatically integrated with:
- User collection (create/delete)
- Teams collection (create/delete)
- Matches collection (create/delete)
- People collection (create/delete)

### 2. Cron Job Monitor ⏰

**Location:** `/admin/globals/cron-monitor`

Monitor scheduled job executions and performance.

#### Tracked Jobs

- **Smart Sync** - Runs every 3 hours, syncs teams with recently completed matches
- **Full Sync** - Runs daily at 3 AM, syncs all FaceIt-enabled teams
- **Session Cleanup** - (Future) Marks stale sessions as inactive

#### Displayed Information

- Job name and status (running, success, failed)
- Start and end timestamps
- Duration in seconds
- Summary data (API calls, matches synced, errors)
- Failure count

#### How to Use

1. Navigate to **Monitoring > Cron Jobs** in the sidebar
2. Filter by job name or status
3. Click "Refresh" to update in real-time
4. Expand "Summary" to see job-specific results
5. Check "Errors" section if job failed

#### Auto-Refresh

The cron monitor automatically refreshes every 30 seconds to show the latest job runs.

### 3. Error Dashboard ⚠️

**Location:** `/admin/globals/error-dashboard`

Monitor and track application errors for debugging.

#### Error Types

- **API Errors** - Backend route failures
- **Frontend Errors** - React component errors
- **Validation Errors** - Data validation failures
- **System Errors** - Database or connection issues

#### Severity Levels

- **Critical** - System-breaking errors (database failures)
- **High** - Major functionality broken
- **Medium** - Feature degradation
- **Low** - Minor issues (404s, validation)

#### How to Use

1. Navigate to **Monitoring > Error Dashboard** in the sidebar
2. Filter by error type, severity, or resolution status
3. View unresolved errors by default
4. Click on error cards to expand stack traces
5. Mark errors as resolved in the Error Logs collection

#### Resolving Errors

To mark an error as resolved:
1. Go to **Monitoring > Error Logs** collection
2. Find the error record
3. Check the "Resolved" checkbox
4. Add notes about the fix
5. Save

### 4. Database Health 📊

**Location:** `/admin/globals/database-health`

System overview and health monitoring dashboard.

#### Displayed Statistics

**Collection Counts:**
- Total records in each collection
- Helps identify data growth

**Recent Activity (Last 100 logs):**
- Total audit logs
- Breakdown by action type

**Error Summary:**
- Total errors logged
- Unresolved error count
- Breakdown by severity

**Cron Job Health:**
- Last run time for each job
- Last status (success/failed)
- Recent failure count

**Active Sessions:**
- Number of currently logged-in users
- List of active users

#### How to Use

1. Navigate to **Monitoring > Database Health** in the sidebar
2. Review all health metrics at a glance
3. Click "Refresh" to update statistics
4. Investigate any warnings (unresolved errors, job failures)

#### Auto-Refresh

The health dashboard automatically refreshes every 60 seconds.

### 5. Active Sessions 👥

**Collection:** `/admin/collections/active-sessions`

Track admin panel sessions for security monitoring.

#### Tracked Information

- User
- Login time
- Last activity timestamp
- IP address
- User agent (browser/device)
- Active status

#### Session Lifecycle

1. **Login** - Session created/updated with current timestamp
2. **Activity** - Last activity updated on each request
3. **Logout** - Session marked as inactive
4. **Cleanup** - Stale sessions (24h+ inactive) marked as inactive

#### How to Use

1. Navigate to **Monitoring > Active Sessions** collection
2. View currently active sessions
3. Check user activity patterns
4. Identify suspicious login patterns (multiple IPs, unusual times)

## Collections

All monitoring data is stored in PostgreSQL collections:

### Audit Logs Collection

**Slug:** `audit-logs`  
**Access:** Admin read-only, system-generated

**Fields:**
- `user` - Relationship to users
- `action` - Action type
- `collection` - Affected collection
- `documentId` - Document ID
- `documentTitle` - Display name
- `metadata` - JSON additional context
- `ipAddress` - Request IP
- `createdAt` - Timestamp

### Error Logs Collection

**Slug:** `error-logs`  
**Access:** Admin read/update (for marking resolved)

**Fields:**
- `user` - Relationship to users (nullable)
- `errorType` - Error category
- `message` - Error message
- `stack` - Stack trace (optional)
- `url` - Where error occurred
- `severity` - Severity level
- `resolved` - Resolution status
- `resolvedAt` - Resolution timestamp
- `notes` - Admin notes
- `createdAt` - Timestamp

### Cron Job Runs Collection

**Slug:** `cron-job-runs`  
**Access:** Admin read-only, system-generated

**Fields:**
- `jobName` - Job identifier
- `status` - Current status
- `startTime` - Start timestamp
- `endTime` - End timestamp (optional)
- `duration` - Duration in seconds
- `summary` - JSON results
- `errors` - Error messages (optional)
- `createdAt` - Timestamp

### Active Sessions Collection

**Slug:** `active-sessions`  
**Access:** Admin read/update

**Fields:**
- `user` - Relationship to users
- `loginTime` - Login timestamp
- `lastActivity` - Last activity timestamp
- `ipAddress` - Session IP
- `userAgent` - Browser/device info
- `isActive` - Active status
- `createdAt` - Timestamp

## Security Features

### Admin-Only Access

All monitoring features are restricted to users with the `admin` role:
- Collections hidden from non-admins
- Globals require admin access
- API endpoints check authentication

### Read-Only Logs

Audit logs, error logs, and cron job runs are system-generated:
- No manual creation
- No manual updates (except error resolution)
- No manual deletion
- Prevents tampering with security logs

### IP Tracking

All audit logs and sessions include IP addresses for:
- Security investigation
- Suspicious activity detection
- Access pattern analysis

## Utilities & Integration

### Audit Logger (`@/utilities/auditLogger`)

```typescript
import { createAuditLog, logLogin, logLogout, logBulkOperation } from '@/utilities/auditLogger'

// Log a custom action
await createAuditLog(payload, {
  user: req.user,
  action: 'create',
  collection: 'teams',
  documentId: team.id,
  documentTitle: team.name,
  req,
})

// Log login
await logLogin(payload, user, req)

// Log bulk operation
await logBulkOperation(payload, user, 'Data Consistency Fix', { recordsFixed: 10 }, req)
```

**Collection Hooks:**
- `createAuditLogHook(collectionName)` - Logs create operations
- `createAuditLogDeleteHook(collectionName)` - Logs delete operations

### Error Logger (`@/utilities/errorLogger`)

```typescript
import { logApiError, logFrontendError, logValidationError } from '@/utilities/errorLogger'

// Log API error
await logApiError(payload, error, '/api/teams', user, 'high')

// Log frontend error
await logFrontendError(payload, error, 'TeamsList', user)

// Log validation error
await logValidationError(payload, 'Invalid team name', 'teams', user)
```

### Cron Logger (`@/utilities/cronLogger`)

```typescript
import { startCronJob, completeCronJob, failCronJob } from '@/utilities/cronLogger'

// Start tracking
const cronJobRunId = await startCronJob(payload, 'smart-sync')

try {
  // ... job logic ...
  
  // Mark as completed
  await completeCronJob(payload, cronJobRunId, { apiCalls: 5, matchesSynced: 10 })
} catch (error) {
  // Mark as failed
  await failCronJob(payload, cronJobRunId, error.message)
}
```

### Session Tracker (`@/utilities/sessionTracker`)

```typescript
import { trackLogin, trackLogout, updateActivity, cleanupStaleSessions } from '@/utilities/sessionTracker'

// Track login
await trackLogin(payload, user, req)

// Update activity (call periodically)
await updateActivity(payload, user.id)

// Track logout
await trackLogout(payload, user.id)

// Cleanup stale sessions (call from cron)
const cleaned = await cleanupStaleSessions(payload)
```

## Best Practices

### For Administrators

1. **Regular Monitoring**
   - Check Database Health daily
   - Review unresolved errors weekly
   - Monitor cron job failures

2. **Security Auditing**
   - Review audit logs for suspicious activity
   - Check active sessions for unusual patterns
   - Investigate failed login attempts

3. **Error Management**
   - Triage errors by severity
   - Resolve critical errors immediately
   - Document fixes in error notes

4. **Performance Tracking**
   - Monitor cron job durations
   - Check for increasing failure rates
   - Review API call counts

### For Developers

1. **Logging Best Practices**
   - Log all security-relevant actions
   - Include meaningful metadata
   - Use appropriate severity levels

2. **Error Handling**
   - Catch and log all errors
   - Provide context in error messages
   - Include stack traces for debugging

3. **Integration**
   - Use audit log hooks for collections
   - Integrate error logging in API routes
   - Track cron job execution

4. **Testing**
   - Verify audit logs are created
   - Test error capture
   - Confirm admin-only access

## Troubleshooting

### Audit Logs Not Appearing

**Cause:** Collection hooks not integrated  
**Solution:** Verify `afterChange` and `afterDelete` hooks are added to collection config

### Cron Jobs Not Tracked

**Cause:** Missing cron logger integration  
**Solution:** Add `startCronJob`, `completeCronJob`, `failCronJob` calls to cron routes

### Errors Not Captured

**Cause:** Error logger not integrated  
**Solution:** Use `logApiError` or `logFrontendError` in try/catch blocks

### Sessions Not Created

**Cause:** Session tracker not integrated with auth  
**Solution:** Add `trackLogin` call to auth hooks (future implementation)

### Non-Admin Can See Monitoring

**Cause:** Access control misconfigured  
**Solution:** Verify `isAdmin` access control is applied to all monitoring collections/globals

## Data Retention

### Current Policy

All monitoring data is retained indefinitely. Consider implementing cleanup policies:

### Recommended Retention

- **Audit Logs:** 90 days (compliance requirement)
- **Error Logs:** 30 days for resolved, 90 days for unresolved
- **Cron Job Runs:** 30 days
- **Active Sessions:** Auto-cleanup after 24h inactive

### Future Cleanup Implementation

Create a cleanup cron job to archive or delete old records:

```typescript
// Example cleanup logic
const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

await payload.delete({
  collection: 'audit-logs',
  where: {
    createdAt: { less_than: ninetyDaysAgo.toISOString() }
  }
})
```

## Future Enhancements

### Planned Features

1. **Email Alerts**
   - Critical error notifications
   - Cron job failure alerts
   - Suspicious activity warnings

2. **Session Tracking Integration**
   - Automatic login/logout tracking via Payload auth hooks
   - Activity updates on API requests

3. **Advanced Filtering**
   - Date range filters
   - Multi-field search
   - Export to CSV

4. **Dashboard Widgets**
   - Error trend charts
   - Cron job performance graphs
   - User activity heatmaps

5. **Automated Cleanup**
   - Configurable retention policies
   - Automatic archival
   - Storage optimization

## Support

For issues or questions about the monitoring suite:

1. Check this documentation
2. Review the implementation in `src/collections/` and `src/utilities/`
3. Check the codebase for examples
4. Contact the development team

## Changelog

### December 30, 2025 - Initial Release

- ✅ Audit Log collection and viewer
- ✅ Error Log collection and dashboard
- ✅ Cron Job Runs collection and monitor
- ✅ Active Sessions collection
- ✅ Database Health dashboard
- ✅ Admin-only access controls
- ✅ Integration utilities
- ✅ SCSS styling
- ✅ Complete documentation


