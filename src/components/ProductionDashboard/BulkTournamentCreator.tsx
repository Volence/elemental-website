'use client'

import React, { useState } from 'react'
import { toast } from '@payloadcms/ui'

interface TournamentSlot {
  date: string // YYYY-MM-DD
  title: string
  time: string // HH:MM (24h format)
}

interface BulkTournamentCreatorProps {
  onClose?: () => void
  onSuccess?: () => void
}

export function BulkTournamentCreator({ onClose, onSuccess }: BulkTournamentCreatorProps) {
  const [region, setRegion] = useState<'NA' | 'EMEA' | 'SA'>('NA')
  const [division, setDivision] = useState<'Masters' | 'Expert' | 'Advanced' | 'Open'>('Advanced')
  const [defaultTime, setDefaultTime] = useState('21:00')
  const [season, setSeason] = useState('')
  const [baseTitle, setBaseTitle] = useState('') // Base title for all slots
  const [slots, setSlots] = useState<TournamentSlot[]>([])
  const [creating, setCreating] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [dateOffset, setDateOffset] = useState(0) // Offset in days from today

  const DAYS_PER_PAGE = 28 // 4 weeks per page

  // Get timezone based on region
  const getTimezone = () => {
    switch (region) {
      case 'EMEA': return 'CET'
      case 'SA': return 'BRT'
      default: return 'EST'
    }
  }

  // Add selected dates as slots
  const handleAddDates = () => {
    const newSlots = selectedDates
      .filter(date => !slots.some(s => s.date === date))
      .map(date => ({
        date,
        title: '',
        time: defaultTime,
      }))
    
    setSlots([...slots, ...newSlots].sort((a, b) => a.date.localeCompare(b.date)))
    setSelectedDates([])
    setShowDatePicker(false)
  }

  // Remove a slot
  const handleRemoveSlot = (date: string) => {
    setSlots(slots.filter(s => s.date !== date))
  }

  // Update slot title
  const handleUpdateTitle = (date: string, title: string) => {
    setSlots(slots.map(s => s.date === date ? { ...s, title } : s))
  }

  // Update slot time override
  const handleUpdateTime = (date: string, time: string) => {
    setSlots(slots.map(s => s.date === date ? { ...s, time } : s))
  }

  // Toggle date selection
  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date) 
        : [...prev, date].sort()
    )
  }

  // Generate date range for picker based on offset
  const generateDateRange = () => {
    const dates: string[] = []
    const today = new Date()
    for (let i = 0; i < DAYS_PER_PAGE; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + dateOffset + i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  // Get the date range label for display
  const getDateRangeLabel = () => {
    const dates = generateDateRange()
    const startDate = new Date(dates[0] + 'T12:00:00')
    const endDate = new Date(dates[dates.length - 1] + 'T12:00:00')
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Get total count of slots to create (from slots list + selected dates)
  const getTotalSlotCount = () => {
    const slotDates = new Set(slots.map(s => s.date))
    const uniqueSelectedDates = selectedDates.filter(d => !slotDates.has(d))
    return slots.length + uniqueSelectedDates.length
  }

  // Create tournament slots
  const handleCreate = async () => {
    const totalCount = getTotalSlotCount()
    if (totalCount === 0) {
      toast.error('Please select at least one date')
      return
    }

    // Combine slots and selected dates
    const slotDates = new Set(slots.map(s => s.date))
    const allSlots = [
      ...slots,
      ...selectedDates
        .filter(d => !slotDates.has(d))
        .map(date => ({ date, title: '', time: defaultTime }))
    ].sort((a, b) => a.date.localeCompare(b.date))

    setCreating(true)
    try {
      const response = await fetch('/api/production/bulk-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region,
          division,
          defaultTime,
          defaultTimezone: getTimezone(),
          season,
          baseTitle,
          slots: allSlots.map(s => ({
            date: s.date,
            title: s.title || undefined,
            time: s.time !== defaultTime ? s.time : undefined,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create tournament slots')
      }

      toast.success(data.message || `Created ${data.createdCount} tournament slots`)
      setSlots([])
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create tournament slots')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bulk-tournament-creator">
      <div className="bulk-tournament-creator__header">
        <h3>📅 Bulk Tournament Creator</h3>
        <p>Create multiple tournament match slots for staff signups</p>
      </div>

      {/* Configuration */}
      <div className="bulk-tournament-creator__config">
        <div className="bulk-tournament-creator__row">
          <div className="bulk-tournament-creator__field">
            <label>Region</label>
            <select value={region} onChange={e => setRegion(e.target.value as any)}>
              <option value="NA">North America</option>
              <option value="EMEA">EMEA (Europe)</option>
              <option value="SA">South America</option>
            </select>
          </div>

          <div className="bulk-tournament-creator__field">
            <label>Division</label>
            <select value={division} onChange={e => setDivision(e.target.value as any)}>
              <option value="Masters">Masters</option>
              <option value="Expert">Expert</option>
              <option value="Advanced">Advanced</option>
              <option value="Open">Open</option>
              {/* NOTE: 'Other' option requires database migration */}
            </select>
          </div>
        </div>

        <div className="bulk-tournament-creator__row">
          <div className="bulk-tournament-creator__field">
            <label>Default Time ({getTimezone()})</label>
            <input 
              type="time" 
              value={defaultTime} 
              onChange={e => setDefaultTime(e.target.value)}
            />
          </div>

          <div className="bulk-tournament-creator__field">
            <label>Season (Optional)</label>
            <input 
              type="text" 
              value={season} 
              onChange={e => setSeason(e.target.value)}
              placeholder="e.g., S7 Playoffs"
            />
          </div>
        </div>

        <div className="bulk-tournament-creator__row">
          <div className="bulk-tournament-creator__field bulk-tournament-creator__field--wide">
            <label>Base Title (Recommended)</label>
            <input 
              type="text" 
              value={baseTitle} 
              onChange={e => setBaseTitle(e.target.value)}
              placeholder="e.g., S7 Playoffs NA Advanced - identifies all slots"
            />
          </div>
        </div>
      </div>

      {/* Date Picker */}
      <div className="bulk-tournament-creator__dates-section">
        <div className="bulk-tournament-creator__dates-header">
          <h4>Match Dates</h4>
          <button 
            className="bulk-tournament-creator__add-btn"
            onClick={() => setShowDatePicker(!showDatePicker)}
          >
            {showDatePicker ? '✕ Close' : '+ Add Dates'}
          </button>
        </div>

        {showDatePicker && (
          <div className="bulk-tournament-creator__date-picker">
            {/* Date Range Navigation */}
            <div className="bulk-tournament-creator__date-nav">
              <button 
                className="bulk-tournament-creator__nav-btn"
                onClick={() => setDateOffset(Math.max(0, dateOffset - DAYS_PER_PAGE))}
                disabled={dateOffset === 0}
              >
                ← Previous
              </button>
              <span className="bulk-tournament-creator__date-range">
                {getDateRangeLabel()}
              </span>
              <button 
                className="bulk-tournament-creator__nav-btn"
                onClick={() => setDateOffset(dateOffset + DAYS_PER_PAGE)}
              >
                Next →
              </button>
            </div>
            
            <p className="bulk-tournament-creator__date-picker-hint">
              Click dates to select them, then click "Add Selected"
            </p>
            <div className="bulk-tournament-creator__date-grid">
              {generateDateRange().map(date => (
                <button
                  key={date}
                  className={`bulk-tournament-creator__date-btn ${
                    selectedDates.includes(date) ? 'selected' : ''
                  } ${slots.some(s => s.date === date) ? 'already-added' : ''}`}
                  onClick={() => !slots.some(s => s.date === date) && toggleDateSelection(date)}
                  disabled={slots.some(s => s.date === date)}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>
            {selectedDates.length > 0 && (
              <button 
                className="bulk-tournament-creator__confirm-dates-btn"
                onClick={handleAddDates}
              >
                Add {selectedDates.length} Date{selectedDates.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Slots List */}
      {slots.length > 0 && (
        <div className="bulk-tournament-creator__slots">
          <h4>Selected Dates ({slots.length})</h4>
          <div className="bulk-tournament-creator__slots-list">
            {slots.map(slot => (
              <div key={slot.date} className="bulk-tournament-creator__slot">
                <div className="bulk-tournament-creator__slot-date">
                  {formatDate(slot.date)}
                </div>
                <input
                  type="text"
                  className="bulk-tournament-creator__slot-title"
                  value={slot.title}
                  onChange={e => handleUpdateTitle(slot.date, e.target.value)}
                  placeholder="Round title (e.g., UBR1)"
                />
                <input
                  type="time"
                  className="bulk-tournament-creator__slot-time"
                  value={slot.time}
                  onChange={e => handleUpdateTime(slot.date, e.target.value)}
                />
                <button 
                  className="bulk-tournament-creator__slot-remove"
                  onClick={() => handleRemoveSlot(slot.date)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bulk-tournament-creator__actions">
        {onClose && (
          <button 
            className="bulk-tournament-creator__cancel-btn"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
        )}
        <button 
          className="bulk-tournament-creator__create-btn"
          onClick={handleCreate}
          disabled={creating || getTotalSlotCount() === 0}
        >
          {creating ? 'Creating...' : `Create ${getTotalSlotCount()} Tournament Slot${getTotalSlotCount() !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

export default BulkTournamentCreator
