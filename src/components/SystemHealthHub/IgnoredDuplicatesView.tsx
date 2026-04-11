'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface IgnoredDuplicate {
  id: string
  label: string
  reason?: string
  createdAt: string
}

export default function IgnoredDuplicatesView() {
  const [duplicates, setDuplicates] = useState<IgnoredDuplicate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDuplicates() {
      try {
        const response = await fetch('/api/ignored-duplicates?limit=100')
        if (!response.ok) throw new Error('Failed to fetch ignored duplicates')
        const data = await response.json()
        setDuplicates(data.docs)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDuplicates()
  }, [])

  return (
    <div className="audit-log"> {/* Reusing the audit log basic container styles */}
      <div className="audit-log__header">
        <div className="audit-log__title">
          <AlertCircle size={20} className="text-warning" />
          <h2>Ignored Duplicates</h2>
        </div>
        <div className="audit-log__actions">
          <Link href="/admin/collections/ignored-duplicates" className="btn btn--primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
            Open Collection to Edit <ExternalLink size={12} style={{ marginLeft: '0.5rem' }} />
          </Link>
        </div>
      </div>

      <p className="system-health__subtitle" style={{ marginBottom: '1.5rem' }}>
        Pairs of people with similar names that have been manually marked as distinct.
      </p>

      {loading && (
        <div className="audit-log__loading">
          Loading ignored duplicates...
        </div>
      )}

      {error && (
        <div className="audit-log__error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && duplicates.length === 0 && (
        <div className="audit-log__empty">
          No ignored duplicate pairs found.
        </div>
      )}

      {!loading && !error && duplicates.length > 0 && (
        <div className="audit-log__table-wrapper">
          <table className="audit-log__table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Reason</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map(doc => (
                <tr key={doc.id}>
                  <td style={{ fontWeight: 600 }}>{doc.label}</td>
                  <td style={{ color: 'rgba(255,255,255,0.6)' }}>{doc.reason || 'No reason provided'}</td>
                  <td>{new Date(doc.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
