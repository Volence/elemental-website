'use client'

import React from 'react'
import { useFormFields, useDocumentInfo } from '@payloadcms/ui'
import { BarChart3 } from 'lucide-react'

import { PollHeatmapView } from '@/components/PollHeatmapView'
import { AvailabilityHeatmapView } from '@/components/AvailabilityHeatmapView'

/**
 * Unified heatmap wrapper that auto-detects `scheduleType` from the form
 * and renders the appropriate heatmap component.
 *
 * Poll  → PollHeatmapView (day-level vote grid)
 * Calendar → AvailabilityHeatmapView (time-slot grid)
 * Manual → "No availability data" message
 */
export const ScheduleHeatmapView: React.FC<{ path: string }> = ({ path }) => {
  const scheduleTypeField = useFormFields(([fields]) => fields['scheduleType'])
  const scheduleType = (scheduleTypeField?.value as string) || 'poll'

  if (scheduleType === 'manual') {
    return (
      <div className="availability-heatmap availability-heatmap--empty">
        <div className="availability-heatmap__empty-message">
          <BarChart3 size={16} />
          <p>Manual schedule — no availability data collected.</p>
          <p className="availability-heatmap__empty-hint">
            Assign roles directly in the Schedule Builder below.
          </p>
        </div>
      </div>
    )
  }

  if (scheduleType === 'calendar') {
    return <AvailabilityHeatmapView path={path} />
  }

  // Default: poll
  return <PollHeatmapView path={path} />
}

export default ScheduleHeatmapView
