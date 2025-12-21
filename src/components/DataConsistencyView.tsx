'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'
import { LoadingState } from './DataConsistency/LoadingState'
import { AccessDenied } from './DataConsistency/AccessDenied'
import { DataConsistencyHeader } from './DataConsistency/DataConsistencyHeader'
import { FixResultMessage } from './DataConsistency/FixResultMessage'
import { SummaryCards } from './DataConsistency/SummaryCards'
import { EmptyState } from './DataConsistency/EmptyState'
import { IssueCard } from './DataConsistency/IssueCard'
import { AboutSection } from './DataConsistency/AboutSection'

interface DetailedIssue {
  type: 'error' | 'warning'
  category: string
  message: string
  items: Array<{
    id: number
    name: string
    slug?: string
    details?: string
  }>
  autoFixable: boolean
}

const DataConsistencyView: React.FC = () => {
  const { user } = useAuth<User>()
  const [issues, setIssues] = useState<DetailedIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const isAdmin = user?.role === UserRole.ADMIN

  useEffect(() => {
    // Wait for user to load
    if (user !== undefined) {
      setAuthLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!isAdmin || authLoading) return
    fetchIssues()
  }, [isAdmin, authLoading])

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/data-consistency-check')
      const data = await response.json()
      setIssues(data.issues || [])
    } catch (error) {
      console.error('Error fetching data consistency issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFixAll = async () => {
    if (!confirm('This will attempt to fix all auto-fixable issues. Continue?')) return

    try {
      setFixing(true)
      setFixResult(null)
      const response = await fetch('/api/fix-data-issues', {
        method: 'POST',
      })
      const result = await response.json()
      setFixResult(result.message || 'Issues fixed successfully')
      // Refresh issues after fixing
      setTimeout(() => fetchIssues(), 1000)
    } catch (error) {
      setFixResult('Error fixing issues: ' + (error as Error).message)
    } finally {
      setFixing(false)
    }
  }

  // Show loading while checking authentication
  if (authLoading) {
    return <LoadingState />
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return <AccessDenied user={user} />
  }

  const errorIssues = issues.filter((i) => i.type === 'error')
  const warningIssues = issues.filter((i) => i.type === 'warning')
  const autoFixableCount = issues.filter((i) => i.autoFixable).length

  return (
    <div className="data-consistency">
      <DataConsistencyHeader
        autoFixableCount={autoFixableCount}
        fixing={fixing}
        onFixAll={handleFixAll}
      />

      {fixResult && <FixResultMessage message={fixResult} />}

      {loading ? (
        <div className="data-consistency__loading-checks">
          <p>Loading data consistency checks...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <SummaryCards
            errorCount={errorIssues.length}
            warningCount={warningIssues.length}
            autoFixableCount={autoFixableCount}
          />

          {/* Detailed Issues */}
          {issues.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="issues-list">
              {issues.map((issue, index) => (
                <IssueCard key={index} {...issue} />
              ))}
            </div>
          )}
        </>
      )}

      <AboutSection />
    </div>
  )
}

export default DataConsistencyView
