import React from 'react'

interface CalendarHeaderProps {
  eventCount: number
}

export function CalendarHeader({ eventCount }: CalendarHeaderProps) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent mb-3">
        Calendar
      </h1>
      <p className="text-gray-400 text-lg">
        Ongoing and upcoming events
        {eventCount > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
            {eventCount} events
          </span>
        )}
      </p>
    </div>
  )
}
