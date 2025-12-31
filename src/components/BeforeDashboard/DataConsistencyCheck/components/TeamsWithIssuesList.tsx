import React from 'react'

interface TeamWithIssues {
  teamId: number
  teamName: string
  teamSlug: string
  issues: string[]
}

interface TeamsWithIssuesListProps {
  teams: TeamWithIssues[]
}

export const TeamsWithIssuesList: React.FC<TeamsWithIssuesListProps> = ({ teams }) => {
  if (teams.length === 0) return null

  return (
    <div className="mb-6">
      <h4 className="mb-2 font-semibold">
        ⚠️ Teams with Missing Person Relationships ({teams.length})
      </h4>
      <p className="text-sm mb-3 opacity-80">
        These teams have entries with names but no Person relationship. Consider linking them to
        People entries.
      </p>
      <div className="grid gap-2">
        {teams.map((team) => (
          <div
            key={team.teamId}
            className="notification-item notification-item--warning"
            style={{ flexDirection: 'column' as const, alignItems: 'flex-start' }}
          >
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>{team.teamName}</strong>
              <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.875rem' }}>({team.teamSlug})</span>
              <a
                href={`/admin/collections/teams/${team.teamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="notification-btn notification-btn--view"
                style={{ marginLeft: '0.5rem' }}
              >
                View
              </a>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {team.issues.map((issue, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>{issue}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

