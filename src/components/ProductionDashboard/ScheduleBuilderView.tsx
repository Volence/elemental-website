'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button, toast } from '@payloadcms/ui'
import { AlertTriangle, CheckCircle, Clapperboard, ClipboardList, Eye, Lock, Megaphone, Mic, Send, Settings } from 'lucide-react'
import { AdminModal, formatRelative } from '@/admin-kit'
import { formatStaffSchedule, formatPublicSchedule, type ScheduleMatch } from '@/utilities/productionSchedulePost'

type Match = ScheduleMatch & {
  title: string
  productionWorkflow?: ScheduleMatch['productionWorkflow'] & { coverageStatus: string }
}

interface PostInfo {
  channels: { staff: boolean; public: boolean }
  posted: { at: string | null; by: string | null; matchIds: number[] } | null
}

export function ScheduleBuilderView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedInternal, setCopiedInternal] = useState(false)
  const [copiedPublic, setCopiedPublic] = useState(false)
  const [postInfo, setPostInfo] = useState<PostInfo | null>(null)
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [posting, setPosting] = useState<'update' | 'new' | null>(null)

  const fetchPostInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/production/schedule-post', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setPostInfo({ channels: data.channels, posted: data.posted })
    } catch {
      // The preview still works without post state
    }
  }, [])

  useEffect(() => {
    fetchMatches()
    fetchPostInfo()
  }, [fetchPostInfo])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Fetch upcoming matches with at least partial coverage
      const query = `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&where[productionWorkflow.isArchived][not_equals]=true&where[status][not_equals]=complete&sort=date&limit=100&depth=2`

      const response = await fetch(query)
      const data = await response.json()

      // Filter to only matches with partial or full coverage
      const withCoverage = (data.docs || []).filter(
        (m: Match) => m.productionWorkflow?.coverageStatus === 'partial' || m.productionWorkflow?.coverageStatus === 'full'
      )

      setMatches(withCoverage)
    } catch (error) {
      console.error('Error fetching matches:', error)
      toast.error('Error fetching matches')
    } finally {
      setLoading(false)
    }
  }

  const toggleIncludeInSchedule = async (matchId: number, currentValue: boolean) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return

      // When adding to schedule, check if it's a tournament slot with missing info
      if (!currentValue && match.isTournamentSlot) {
        const hasTeam1 = match.team1Internal || match.team1External || match.team
        const hasTeam2 = match.team2Internal || match.team2External || match.opponent

        if (!hasTeam1 || !hasTeam2) {
          toast.error('This slot is missing team info. Please fill in both teams before adding to schedule.')
          return
        }
      }

      const updateData: any = {
        productionWorkflow: {
          ...match.productionWorkflow,
          includeInSchedule: !currentValue
        }
      }

      // When adding a tournament slot to schedule, convert it to a real match
      if (!currentValue && match.isTournamentSlot) {
        updateData.isTournamentSlot = false
        toast.info('Converting tournament slot to confirmed match')
      }

      await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      // Update local state
      setMatches(matches.map(m =>
        m.id === matchId
          ? {
              ...m,
              isTournamentSlot: !currentValue ? false : m.isTournamentSlot,
              productionWorkflow: {
                ...m.productionWorkflow!,
                includeInSchedule: !currentValue
              }
            }
          : m
      ))

      toast.success(!currentValue ? 'Added to schedule' : 'Removed from schedule')
    } catch (error) {
      console.error('Error updating match:', error)
      toast.error('Error updating match')
    }
  }

  const copyToClipboard = (text: string, type: 'internal' | 'public') => {
    navigator.clipboard.writeText(text)
    if (type === 'internal') {
      setCopiedInternal(true)
      setTimeout(() => setCopiedInternal(false), 2000)
    } else {
      setCopiedPublic(true)
      setTimeout(() => setCopiedPublic(false), 2000)
    }
    toast.success('Copied to clipboard!')
  }

  const handlePost = async (mode: 'update' | 'new') => {
    setPosting(mode)
    try {
      const res = await fetch('/api/production/schedule-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to post')
      toast.success(data.updated ? 'Discord schedule updated' : 'Schedule posted to Discord')
      setPostModalOpen(false)
      fetchPostInfo()
    } catch (err: any) {
      toast.error(err.message || 'Failed to post')
    } finally {
      setPosting(null)
    }
  }

  const selectedCount = matches.filter(m => m.productionWorkflow?.includeInSchedule).length
  const staffPreview = formatStaffSchedule(matches, { mentionStyle: 'preview' })
  const publicPreview = formatPublicSchedule(matches)
  const channelsConfigured = !!postInfo && (postInfo.channels.staff || postInfo.channels.public)
  const hasPost = !!postInfo?.posted

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  return (
    <div className="production-dashboard__schedule-builder">
      <div className="production-dashboard__header">
        <div>
          <h2>Schedule Builder</h2>
          <p className="production-dashboard__subtitle">
            Select matches with coverage to broadcast, then post the schedule to Discord.
          </p>
          <div className="production-dashboard__instructions">
            <strong>How it works:</strong>
            <ol>
              <li>Check the boxes for matches you want to broadcast</li>
              <li>Preview the staff and public posts on the right</li>
              <li>Click &quot;Post to Discord&quot; once the week is ready</li>
              <li>Later changes to assignments, times or lobbies update the Discord posts on their own</li>
            </ol>
          </div>
        </div>
        <div className="schedule-builder__stats">
          <span className="schedule-builder__stat">
            {matches.length} matches with coverage
          </span>
          <span className="schedule-builder__stat schedule-builder__stat--highlight">
            {selectedCount} selected
          </span>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="production-dashboard__empty">
          <p>No matches with coverage found.</p>
          <p>Assign staff in the Assignment tab first, then come back here to build your broadcast schedule.</p>
        </div>
      ) : (
        <div className="schedule-builder__content">
          <div className="schedule-builder__matches">
            <h3>Available Matches</h3>
            <p className="schedule-builder__instruction">
              <CheckCircle size={12} /> Check matches to include in this week&apos;s broadcast schedule
            </p>

            <div className="schedule-builder__match-list">
              {matches.map((match) => {
                const pw = match.productionWorkflow!
                const isSelected = !!pw.includeInSchedule
                const isFull = pw.coverageStatus === 'full'

                return (
                  <div
                    key={match.id}
                    className={`schedule-builder__match ${isSelected ? 'schedule-builder__match--selected' : ''}`}
                  >
                    <label className="schedule-builder__match-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleIncludeInSchedule(match.id, isSelected)}
                        className="schedule-builder__checkbox"
                      />
                      <div className="schedule-builder__match-info">
                        <div className="schedule-builder__match-header">
                          <strong>{match.title}</strong>
                          <span className={`coverage-badge coverage-badge--${pw.coverageStatus}`}>
                            {isFull ? <><CheckCircle size={12} /> Full</> : <><AlertTriangle size={12} /> Partial</>}
                          </span>
                        </div>
                        <div className="schedule-builder__match-meta">
                          <span>{new Date(match.date).toLocaleString()}</span>
                          <span>
                            {pw.assignedObserver && pw.assignedProducer ? <><Eye size={14} /><Clapperboard size={14} /></> : ''}{' '}
                            {pw.assignedCasters?.length ? <><Mic size={14} />×{pw.assignedCasters.length}</> : ''}
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="schedule-builder__export">
            <div className="schedule-builder__post">
              <div className="schedule-builder__post-status">
                {postInfo && !channelsConfigured ? (
                  <span className="schedule-builder__post-note schedule-builder__post-note--warning">
                    <AlertTriangle size={12} /> No Discord channels configured. An admin sets them in the Settings tab.
                  </span>
                ) : hasPost ? (
                  <span className="schedule-builder__post-note">
                    <CheckCircle size={12} /> Posted {postInfo!.posted!.at ? formatRelative(postInfo!.posted!.at) : ''}
                    {postInfo!.posted!.by ? ` by ${postInfo!.posted!.by}` : ''}. Edits update Discord automatically.
                  </span>
                ) : (
                  <span className="schedule-builder__post-note">
                    <Send size={12} /> Nothing posted yet this week.
                  </span>
                )}
              </div>
              <Button
                onClick={() => setPostModalOpen(true)}
                disabled={selectedCount === 0 || !channelsConfigured}
                buttonStyle="primary"
              >
                <Send size={14} /> Post to Discord
              </Button>
            </div>

            <div className="schedule-builder__preview-section">
              <div className="schedule-builder__preview-header">
                <h4><Lock size={14} /> Internal (Staff Channel)</h4>
                <Button
                  onClick={() => copyToClipboard(staffPreview, 'internal')}
                  disabled={selectedCount === 0}
                  buttonStyle="secondary"
                >
                  {copiedInternal ? '✓ Copied!' : <><ClipboardList size={14} /> Copy</>}
                </Button>
              </div>
              <pre className="schedule-builder__preview">{staffPreview}</pre>
            </div>

            <div className="schedule-builder__preview-section">
              <div className="schedule-builder__preview-header">
                <h4><Megaphone size={14} /> Public (Announcements)</h4>
                <Button
                  onClick={() => copyToClipboard(publicPreview, 'public')}
                  disabled={selectedCount === 0}
                  buttonStyle="secondary"
                >
                  {copiedPublic ? '✓ Copied!' : <><ClipboardList size={14} /> Copy</>}
                </Button>
              </div>
              <pre className="schedule-builder__preview">{publicPreview}</pre>
            </div>
          </div>
        </div>
      )}

      <AdminModal
        open={postModalOpen}
        onClose={() => !posting && setPostModalOpen(false)}
        title="Post broadcast schedule to Discord"
        icon={<Send size={16} />}
        size="sm"
        footer={
          <div className="schedule-builder__post-actions">
            <Button buttonStyle="secondary" onClick={() => setPostModalOpen(false)} disabled={!!posting}>Cancel</Button>
            {hasPost && (
              <Button buttonStyle="secondary" onClick={() => handlePost('new')} disabled={!!posting}>
                {posting === 'new' ? 'Posting...' : 'Start a new week'}
              </Button>
            )}
            <Button buttonStyle="primary" onClick={() => handlePost(hasPost ? 'update' : 'new')} disabled={!!posting}>
              {posting === 'update' ? 'Updating...' : posting === 'new' && !hasPost ? 'Posting...' : hasPost ? 'Update current post' : 'Post now'}
            </Button>
          </div>
        }
      >
        <p>
          {selectedCount} {selectedCount === 1 ? 'match' : 'matches'} will go to{' '}
          {[postInfo?.channels.staff && 'the staff channel', postInfo?.channels.public && 'the announcements channel'].filter(Boolean).join(' and ')}.
          Staff names in the internal post become real pings for anyone with a linked Discord account.
        </p>
        {hasPost ? (
          <p>
            <strong>Update current post</strong> edits the messages already in Discord. <strong>Start a new week</strong> leaves them
            alone and posts fresh messages, which the schedule then follows from here on.
          </p>
        ) : (
          <p>After the first post, changes to these matches update the Discord messages automatically.</p>
        )}
        <p className="schedule-builder__post-hint">
          <Settings size={12} /> Channels are configured by an admin in the Settings tab.
        </p>
      </AdminModal>
    </div>
  )
}
