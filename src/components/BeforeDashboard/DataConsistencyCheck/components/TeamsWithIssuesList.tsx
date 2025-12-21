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
            className="p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
          >
            <div className="mb-2">
              <strong>{team.teamName}</strong>
              <span className="ml-2 opacity-70 text-sm">({team.teamSlug})</span>
              <a
                href={`/admin/collections/teams/${team.teamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm inline-block hover:bg-blue-700 transition-colors"
              >
                View
              </a>
            </div>
            <ul className="m-0 pl-6 text-sm space-y-1">
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

