'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { SchedulePageData, ScheduleTab } from './types'

interface ScheduleContextValue {
  data: SchedulePageData
  activeTab: ScheduleTab
  setActiveTab: (tab: ScheduleTab) => void
  refreshData: () => Promise<void>
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null)

export function useSchedule() {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}

interface ScheduleProviderProps {
  initialData: SchedulePageData
  initialTab: ScheduleTab
  children: React.ReactNode
}

export function ScheduleProvider({ initialData, initialTab, children }: ScheduleProviderProps) {
  const [data, setData] = useState<SchedulePageData>(initialData)
  const [activeTab, setActiveTab] = useState<ScheduleTab>(initialTab)

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/${data.team.slug}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } catch (err) {
      console.error('Failed to refresh schedule data:', err)
    }
  }, [data.team.slug])

  return (
    <ScheduleContext.Provider value={{ data, activeTab, setActiveTab, refreshData }}>
      {children}
    </ScheduleContext.Provider>
  )
}
