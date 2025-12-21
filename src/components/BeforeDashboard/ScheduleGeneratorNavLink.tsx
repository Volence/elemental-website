'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'

const ScheduleGeneratorNavLink = () => {
  return (
    <div style={{ margin: 0 }}>
      <Link
        href="/admin/schedule-generator"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.5rem 0.75rem',
          color: 'var(--theme-text-500, rgba(255, 255, 255, 0.7))',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 400,
          lineHeight: '1.25rem',
          borderRadius: '4px',
          margin: 0,
          transition: 'all 0.15s ease',
        }}
        className="schedule-generator-link"
      >
        <Calendar style={{ width: '18px', height: '18px', flexShrink: 0 }} />
        <span>Schedule Generator</span>
      </Link>
      <style jsx global>{`
        .schedule-generator-link:hover {
          background-color: var(--theme-elevation-100);
          color: var(--theme-text);
        }
      `}</style>
    </div>
  )
}

export default ScheduleGeneratorNavLink




