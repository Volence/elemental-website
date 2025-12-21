import React from 'react'

interface IssueItem {
  id: number
  name: string
  slug?: string
  details?: string
}

interface IssueCardProps {
  type: 'error' | 'warning'
  category: string
  message: string
  items: IssueItem[]
  autoFixable: boolean
}

export function IssueCard({ type, category, message, items, autoFixable }: IssueCardProps) {
  const hasSlug = items.some((item) => item.slug)
  const hasDetails = items.some((item) => item.details)

  return (
    <div className={`issue-card issue-card--${type}`}>
      <div className="issue-card__header">
        <div>
          <h3 className={`issue-card__title issue-card__title--${type}`}>
            {type === 'error' ? '❌' : '⚠️'} {category}
          </h3>
          <p className="issue-card__message">{message}</p>
        </div>
        {autoFixable && <span className="issue-card__badge">Auto-Fixable</span>}
      </div>

      {/* List of affected items */}
      {items.length > 0 && (
        <div>
          <h4 className="issue-card__items-title">Affected Items ({items.length}):</h4>
          <div className="issue-card__items-container">
            <table className="issue-card__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  {hasSlug && <th>Slug</th>}
                  {hasDetails && <th>Details</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="issue-card__table-cell--id">{item.id}</td>
                    <td>{item.name}</td>
                    {hasSlug && (
                      <td className="issue-card__table-cell--slug">{item.slug || '-'}</td>
                    )}
                    {hasDetails && (
                      <td className="issue-card__table-cell--details">{item.details || '-'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
