'use client'

import React, { useEffect, lazy, Suspense } from 'react'
import { useStepNav } from '@payloadcms/ui'

const ScrimListView = lazy(() => import('@/components/ScrimList'))

const LoadingFallback = () => (
  <div style={{ padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>
)

/**
 * Main Scrim Analytics Dashboard.
 * Default landing page shows the Scrims list (which includes shared tabs).
 */
export default function ScrimAnalyticsDashboard() {
  const { setStepNav } = useStepNav()

  useEffect(() => {
    setStepNav([])
  }, [setStepNav])

  return (
    <div className="scrim-analytics-dashboard">
      <Suspense fallback={<LoadingFallback />}>
        <ScrimListView />
      </Suspense>
    </div>
  )
}
