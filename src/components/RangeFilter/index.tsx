'use client'

import React from 'react'

export type RangeValue = 'last20' | 'last50' | 'last30d' | 'all'

const RANGE_OPTIONS: { value: RangeValue; label: string }[] = [
  { value: 'last20', label: 'Last 20 maps' },
  { value: 'last50', label: 'Last 50 maps' },
  { value: 'last30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

interface RangeFilterProps {
  value: RangeValue
  onChange: (v: RangeValue) => void
}

export default function RangeFilter({ value, onChange }: RangeFilterProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as RangeValue)}
      style={{
        background: '#141c35',
        color: '#e2e8f0',
        border: '1px solid #1e293b',
        borderRadius: '6px',
        padding: '6px 28px 6px 10px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#06b6d4' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#1e293b' }}
    >
      {RANGE_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value} style={{ background: '#0f1629', color: '#e2e8f0' }}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
