'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'

const ScheduleGeneratorNavLink = () => {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <Link
        href="/admin/schedule-generator"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          color: 'var(--theme-text)',
          textDecoration: 'none',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
        }}
        className="schedule-generator-link"
      >
        <Calendar style={{ width: '20px', height: '20px' }} />
        <span>Schedule Generator</span>
      </Link>
      <style jsx global>{`
        .schedule-generator-link:hover {
          background-color: var(--theme-elevation-150);
        }
      `}</style>
    </div>
  )
}

export default ScheduleGeneratorNavLink


