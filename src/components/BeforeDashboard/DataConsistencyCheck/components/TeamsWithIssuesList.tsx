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
        Teams with Missing Person Relationships ({teams.length})
      </h4>
      <p className="text-sm mb-3 opacity-80">
        These teams have entries with names but no Person relationship. Consider linking them to
        People entries.
      </p>
      <div className="grid gap-2">
        {teams.map((team) => (
          <div
            key={team.teamId}
            className="notification-item notification-item--warning dc-check__issue-item"
          >
            <div className="dc-check__issue-row">
              <strong>{team.teamName}</strong>
              <span className="dc-check__slug">({team.teamSlug})</span>
              <a
                href={`/admin/collections/teams/${team.teamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="notification-btn notification-btn--view dc-check__view-link"
              >
                View
              </a>
            </div>
            <ul className="dc-check__issues-list">
              {team.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
