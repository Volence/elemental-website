'use client'

import React, { useState } from 'react'

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
  onRefresh?: () => void
}

export function IssueCard({ type, category, message, items, autoFixable, onRefresh }: IssueCardProps) {
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set())
  const [ignoring, setIgnoring] = useState<number | null>(null)
  const [ignoredIds, setIgnoredIds] = useState<Set<number>>(new Set())
  
  const hasSlug = items.some((item) => item.slug)
  const hasDetails = items.some((item) => item.details)
  
  // Only show delete button for Orphaned People
  const isOrphanedPeople = category === 'Orphaned People'
  // Only show ignore button for Potential Duplicates
  const isPotentialDuplicates = category === 'Potential Duplicates'
  
  const handleDelete = async (item: IssueItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(item.id)
    try {
      const response = await fetch(`/api/people/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete person')
      }

      // Mark as deleted
      setDeletedIds(prev => new Set(prev).add(item.id))
      
      // Notify parent to refresh data
      if (onRefresh) {
        setTimeout(() => onRefresh(), 500)
      }
    } catch (error) {
      console.error('Error deleting person:', error)
      alert('Failed to delete person. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const handleIgnore = async (item: IssueItem) => {
    // Extract the "other person" ID from the details string
    // Details format: "83% match with \"OtherName\""
    const match = item.details?.match(/match with "([^"]+)"/)
    if (!match) {
      alert('Could not determine which duplicate to ignore')
      return
    }

    const otherPersonName = match[1]
    const otherPerson = items.find(i => i.name === otherPersonName)
    
    if (!otherPerson) {
      alert('Could not find the other person in this pair')
      return
    }

    if (!confirm(`Mark "${item.name}" and "${otherPersonName}" as different people? They will no longer appear as duplicates.`)) {
      return
    }

    setIgnoring(item.id)
    try {
      const response = await fetch('/api/ignore-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          person1Id: item.id,
          person2Id: otherPerson.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to ignore duplicate')
      }

      // Mark as ignored
      setIgnoredIds(prev => new Set(prev).add(item.id).add(otherPerson.id))
      
      // Notify parent to refresh data
      if (onRefresh) {
        setTimeout(() => onRefresh(), 500)
      }
    } catch (error) {
      console.error('Error ignoring duplicate:', error)
      alert('Failed to ignore duplicate. Please try again.')
    } finally {
      setIgnoring(null)
    }
  }
  
  const visibleItems = items.filter(item => !deletedIds.has(item.id) && !ignoredIds.has(item.id))

  // If all items are resolved, show success message
  if (visibleItems.length === 0 && (deletedIds.size > 0 || ignoredIds.size > 0)) {
    return (
      <div className="issue-card issue-card--success">
        <div className="issue-card__header">
          <h3 className="issue-card__title">
            ✅ {category}
          </h3>
          <p className="issue-card__message">
            {isOrphanedPeople && 'All orphaned people have been resolved!'}
            {isPotentialDuplicates && 'All duplicates have been resolved!'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`issue-card issue-card--${type}`}>
      <div className="issue-card__header">
        <div className="issue-card__header-content">
          <h3 className={`issue-card__title issue-card__title--${type}`}>
            {type === 'error' ? '❌' : '⚠️'} {category}
          </h3>
          {autoFixable && <span className="issue-card__badge issue-card__badge--fixable">Auto-Fixable</span>}
        </div>
        <p className="issue-card__message">{message}</p>
      </div>

      {/* List of affected items */}
      {visibleItems.length > 0 && (
        <div className="issue-card__items">
          <h4 className="issue-card__items-title">
            <span className="issue-card__items-count">{visibleItems.length}</span> Affected {visibleItems.length === 1 ? 'Item' : 'Items'}
          </h4>
          <div className="issue-card__items-container">
            <table className="issue-card__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  {hasSlug && <th>Slug</th>}
                  {hasDetails && <th>Details</th>}
                  {(isOrphanedPeople || isPotentialDuplicates) && <th className="issue-card__table-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="issue-card__table-cell--id">{item.id}</td>
                    <td className="issue-card__table-cell--name">
                      <a
                        href={`/admin/collections/people/${item.id}`}
                        className="issue-card__name-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.name}
                      </a>
                    </td>
                    {hasSlug && (
                      <td className="issue-card__table-cell--slug">{item.slug || '-'}</td>
                    )}
                    {hasDetails && (
                      <td className="issue-card__table-cell--details">{item.details || '-'}</td>
                    )}
                    {(isOrphanedPeople || isPotentialDuplicates) && (
                      <td className="issue-card__table-cell--actions">
                        {isOrphanedPeople && (
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={deleting === item.id}
                            className="issue-card__action-button issue-card__action-button--delete"
                          >
                            {deleting === item.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                        {isPotentialDuplicates && (
                          <button
                            onClick={() => handleIgnore(item)}
                            disabled={ignoring === item.id}
                            className="issue-card__action-button issue-card__action-button--ignore"
                          >
                            {ignoring === item.id ? 'Ignoring...' : 'Ignore'}
                          </button>
                        )}
                      </td>
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
