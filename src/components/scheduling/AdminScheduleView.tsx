'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useFormFields, useDocumentInfo } from '@payloadcms/ui'
import { ScheduleProvider } from './ScheduleContext'
import { AvailabilityMatrix } from './AvailabilityMatrix'
import type { SchedulePageData } from './types'

const AdminScheduleView: React.FC = () => {
  const { id } = useDocumentInfo()

  const teamField = useFormFields(([fields]) => fields['team'])
  const responsesField = useFormFields(([fields]) => fields['responses'])
  const dateRangeField = useFormFields(([fields]) => fields['dateRange'])
  const timeSlotsField = useFormFields(([fields]) => fields['timeSlots'])
  const scheduleTypeField = useFormFields(([fields]) => fields['scheduleType'])
  const statusField = useFormFields(([fields]) => fields['status'])
  const responseCountField = useFormFields(([fields]) => fields['responseCount'])

  const teamId = teamField?.value as any
  const responses = responsesField?.value as any
  const dateRange = dateRangeField?.value as any
  const timeSlots = timeSlotsField?.value as any
  const scheduleType = scheduleTypeField?.value as string
  const status = statusField?.value as string
  const responseCount = responseCountField?.value as number

  const [teamData, setTeamData] = useState<any>(null)

  useEffect(() => {
    if (!teamId) return
    const tid = typeof teamId === 'object' ? teamId.id : teamId
    if (!tid) return

    fetch(`/api/teams/${tid}?depth=1`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTeamData(data) })
      .catch(() => {})
  }, [teamId])

  const pageData: SchedulePageData | null = useMemo(() => {
    if (!teamData) return null

    const roster = (teamData.roster || [])
      .filter((e: any) => e.person && typeof e.person === 'object')
      .map((e: any) => ({
        person: { id: e.person.id, name: e.person.name, discordId: e.person.discordId, discordAvatar: e.person.discordAvatar },
        role: e.role,
      }))

    const subs = (teamData.subs || [])
      .filter((e: any) => e.person && typeof e.person === 'object')
      .map((e: any) => ({
        person: { id: e.person.id, name: e.person.name, discordId: e.person.discordId, discordAvatar: e.person.discordAvatar },
        role: e.role,
      }))

    return {
      team: {
        id: teamData.id,
        name: teamData.name,
        slug: teamData.slug || '',
        roster,
        subs,
        scheduleBlocks: teamData.scheduleBlocks || [],
        scheduleTimezone: teamData.scheduleTimezone || 'America/New_York',
        rolePreset: teamData.rolePreset || 'specific',
        customRoles: teamData.customRoles,
        discordThreads: teamData.discordThreads || {},
      },
      activeCalendar: {
        id,
        dateRange,
        timeSlots,
        responses,
        status,
        responseCount,
        scheduleType,
      },
      recentSchedules: [],
      absences: [],
      authState: {
        isAuthenticated: true,
        isManager: true,
        isOnRoster: false,
      },
    }
  }, [teamData, id, dateRange, timeSlots, responses, status, responseCount, scheduleType])

  if (scheduleType !== 'calendar') {
    return null
  }

  if (!pageData) {
    return (
      <div style={{ padding: '1rem', color: '#666', fontSize: '0.85rem' }}>
        Loading team data...
      </div>
    )
  }

  return (
    <ScheduleProvider initialData={pageData} initialTab="availability">
      <div style={{ margin: '0 -1rem' }}>
        <AvailabilityMatrix />
      </div>
    </ScheduleProvider>
  )
}

export default AdminScheduleView
