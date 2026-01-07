'use client'

import React, { useState, useEffect } from 'react'

interface LocalDateTimeProps {
  date: Date | string
  format?: 'short' | 'full' | 'time-only' | 'date-only'
  className?: string
}

/**
 * Client-side date/time formatter that uses the user's browser timezone.
 * This component must be used instead of server-side date formatting
 * to show dates in the user's local timezone.
 * 
 * Only renders after client-side mount to avoid hydration mismatch.
 */
export function LocalDateTime({ date, format = 'short', className }: LocalDateTimeProps) {
  const [formattedDate, setFormattedDate] = useState<string>('')
  
  useEffect(() => {
    const d = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(d.getTime())) {
      setFormattedDate('Invalid date')
      return
    }

    let result: string
    switch (format) {
      case 'full':
        // "Wednesday, January 7 - 9:00 PM EST"
        result = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }) + ' - ' + d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        })
        break

      case 'short':
        // "Wed, Jan 7 at 9:00 PM EST"
        result = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }) + ' at ' + d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        })
        break

      case 'time-only':
        // "9:00 PM EST"
        result = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        })
        break

      case 'date-only':
        // "Wednesday, January 7"
        result = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
        break

      default:
        result = d.toLocaleString()
    }
    
    setFormattedDate(result)
  }, [date, format])

  // Return empty during SSR, populated after client mount
  return (
    <span className={className}>
      {formattedDate || '\u00A0'} {/* Non-breaking space as placeholder */}
    </span>
  )
}

/**
 * Format a date for grouping purposes (returns YYYY-MM-DD in user's local timezone)
 */
export function getLocalDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // Use en-CA locale which formats as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Format a date label for section headers
 */
export function formatLocalDateLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
