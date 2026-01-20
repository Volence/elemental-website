'use client'

import React from 'react'
import type { Department } from './types'
import { DEPARTMENTS } from './types'

interface DepartmentFilterBarProps {
  enabled: Department[]
  onChange: (departments: Department[]) => void
}

export function DepartmentFilterBar({ enabled, onChange }: DepartmentFilterBarProps) {
  const allEnabled = enabled.length === DEPARTMENTS.length
  const noneEnabled = enabled.length === 0

  const toggleDepartment = (dept: Department) => {
    if (enabled.includes(dept)) {
      onChange(enabled.filter(d => d !== dept))
    } else {
      onChange([...enabled, dept])
    }
  }

  const selectAll = () => {
    onChange(DEPARTMENTS.map(d => d.value))
  }

  const selectNone = () => {
    onChange([])
  }

  return (
    <div className="department-filter-bar">
      <div className="department-filter-bar__quick-actions">
        <button 
          type="button"
          className={`btn btn--small ${allEnabled ? 'btn--primary' : 'btn--secondary'}`}
          onClick={selectAll}
        >
          All
        </button>
        <button 
          type="button"
          className={`btn btn--small ${noneEnabled ? 'btn--primary' : 'btn--secondary'}`}
          onClick={selectNone}
        >
          None
        </button>
      </div>

      <div className="department-filter-bar__departments">
        {DEPARTMENTS.map((dept) => (
          <label 
            key={dept.value} 
            className="department-filter-bar__checkbox"
          >
            <input
              type="checkbox"
              checked={enabled.includes(dept.value)}
              onChange={() => toggleDepartment(dept.value)}
            />
            <span 
              className="department-filter-bar__color"
              style={{ backgroundColor: dept.color }}
            />
            <span className="department-filter-bar__label">{dept.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
