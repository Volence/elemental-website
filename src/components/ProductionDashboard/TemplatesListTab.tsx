'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, Search, CheckCircle2, XCircle } from 'lucide-react'

interface Template {
  id: number
  name?: string
  isActive?: boolean
  assignedTeams?: Array<{ name: string } | number>
  updatedAt?: string
  scheduleRules?: Array<{
    region?: string
    division?: string
    matchesPerWeek?: number
  }>
}

export function TemplatesListTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        sort: '-updatedAt',
        depth: '1',
      })

      if (search) {
        params.set('where[name][contains]', search)
      }

      const res = await fetch(`/api/tournament-templates?${params}`)
      const data = await res.json()
      setTemplates(data.docs || [])
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const getTeamNames = (teams?: Array<{ name: string } | number>): string => {
    if (!teams || teams.length === 0) return '—'
    return teams
      .map((t) => (typeof t === 'object' ? t.name : `#${t}`))
      .join(', ')
  }

  const getTotalMatchesPerWeek = (rules?: Template['scheduleRules']): number => {
    if (!rules) return 0
    return rules.reduce((sum, r) => sum + (r.matchesPerWeek || 0), 0)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="collection-list-tab">
      {/* Toolbar */}
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{templates.length} templates</span>
          <a
            href="/admin/collections/tournament-templates/create"
            className="collection-list-tab__btn collection-list-tab__btn--primary"
          >
            <Plus size={14} />
            <span>New Template</span>
          </a>
          <a
            href="/admin/collections/tournament-templates"
            className="collection-list-tab__btn"
          >
            <ExternalLink size={14} />
            <span>Full View</span>
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead>
            <tr>
              <th>Template Name</th>
              <th>Active</th>
              <th>Assigned Teams</th>
              <th>Matches/Week</th>
              <th>Last Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="collection-list-tab__loading">Loading...</td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="collection-list-tab__empty">No templates found</td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="collection-list-tab__row">
                  <td className="collection-list-tab__title">
                    <a href={`/admin/collections/tournament-templates/${template.id}`}>
                      {template.name || `Template #${template.id}`}
                    </a>
                  </td>
                  <td>
                    {template.isActive ? (
                      <CheckCircle2 size={16} className="collection-list-tab__icon--active" />
                    ) : (
                      <XCircle size={16} className="collection-list-tab__icon--inactive" />
                    )}
                  </td>
                  <td>{getTeamNames(template.assignedTeams)}</td>
                  <td>{getTotalMatchesPerWeek(template.scheduleRules)}</td>
                  <td>{formatDate(template.updatedAt)}</td>
                  <td>
                    <a
                      href={`/admin/collections/tournament-templates/${template.id}`}
                      className="collection-list-tab__edit-link"
                    >
                      Edit
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
