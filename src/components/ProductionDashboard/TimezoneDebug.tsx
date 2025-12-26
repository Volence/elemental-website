'use client'

import React from 'react'

interface TimezoneDebugProps {
  date: Date | string
}

/**
 * Debug component to show the same time in multiple timezones
 * Useful for testing timezone conversion
 * 
 * Usage: Add this to any Production Dashboard view temporarily
 */
export function TimezoneDebug({ date }: TimezoneDebugProps) {
  const d = typeof date === 'string' ? new Date(date) : date

  const timezones = [
    { name: 'New York (EST/EDT)', tz: 'America/New_York', flag: '🗽' },
    { name: 'Los Angeles (PST/PDT)', tz: 'America/Los_Angeles', flag: '🌴' },
    { name: 'London (GMT/BST)', tz: 'Europe/London', flag: '🇬🇧' },
    { name: 'Berlin (CET/CEST)', tz: 'Europe/Berlin', flag: '🇩🇪' },
    { name: 'Tokyo (JST)', tz: 'Asia/Tokyo', flag: '🇯🇵' },
    { name: 'Sydney (AEDT)', tz: 'Australia/Sydney', flag: '🇦🇺' },
  ]

  return (
    <div className="timezone-debug">
      <div className="timezone-debug__header">
        <h4>🌍 Timezone Debug</h4>
        <p>Same match time shown in multiple timezones:</p>
      </div>
      
      <div className="timezone-debug__grid">
        {timezones.map((tz) => {
          const formatted = new Intl.DateTimeFormat('en-US', {
            timeZone: tz.tz,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          }).format(d)

          return (
            <div key={tz.tz} className="timezone-debug__item">
              <div className="timezone-debug__flag">{tz.flag}</div>
              <div className="timezone-debug__name">{tz.name}</div>
              <div className="timezone-debug__time">{formatted}</div>
            </div>
          )
        })}
      </div>

      <div className="timezone-debug__current">
        <strong>Your Browser Timezone:</strong> {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </div>

      <div className="timezone-debug__note">
        💡 <strong>Tip:</strong> Use Chrome DevTools → Sensors to override your timezone and test the UI
      </div>
    </div>
  )
}

