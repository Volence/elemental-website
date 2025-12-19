'use client'

import React, { useEffect, useState } from 'react'
import { useFormFields, useDocumentInfo } from '@payloadcms/ui'

/**
 * Component that displays roster counts at the top of the Roster tab
 */
const RosterCount: React.FC = () => {
  const allFields = useFormFields(([fields]) => fields)
  const docInfo = useDocumentInfo()
  
  // Get counts from field values
  const rosterCount = typeof allFields?.roster?.value === 'number' ? allFields.roster.value : 0
  const subsCount = typeof allFields?.subs?.value === 'number' ? allFields.subs.value : 0
  const totalPlayers = rosterCount + subsCount
  
  // For role counts, we need to actually fetch the roster data
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({})
  
  useEffect(() => {
    // Try to get roster data from document
    const doc = (docInfo as any)?.currentDocument || (docInfo as any)?.document || {}
    const roster = doc?.roster || []
    
    if (Array.isArray(roster) && roster.length > 0) {
      const counts = roster.reduce(
        (acc: Record<string, number>, player: any) => {
          if (player?.role) {
            acc[player.role] = (acc[player.role] || 0) + 1
          }
          return acc
        },
        {} as Record<string, number>,
      )
      setRoleCounts(counts)
    }
  }, [docInfo])
  
  console.log('[RosterCount] Counts:', { rosterCount, subsCount, totalPlayers, roleCounts })

  if (totalPlayers === 0) {
    return (
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--theme-elevation-100)',
          border: '1px solid var(--theme-elevation-300)',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--theme-text-600)',
        }}
      >
        No players on roster yet
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--theme-info-50)',
        border: '1px solid var(--theme-info-300)',
        borderRadius: '6px',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: 'var(--theme-text)' }}>Total Players:</strong>{' '}
          <span style={{ color: 'var(--theme-info-700)', fontWeight: 600 }}>{totalPlayers}</span>
        </div>
        {rosterCount > 0 && (
          <div>
            <strong style={{ color: 'var(--theme-text)' }}>Active Roster:</strong>{' '}
            <span style={{ color: 'var(--theme-text-700)' }}>{rosterCount}</span>
          </div>
        )}
        {subsCount > 0 && (
          <div>
            <strong style={{ color: 'var(--theme-text)' }}>Substitutes:</strong>{' '}
            <span style={{ color: 'var(--theme-text-700)' }}>{subsCount}</span>
          </div>
        )}
        {Object.keys(roleCounts).length > 0 && (
          <>
            {roleCounts.tank > 0 && (
              <div>
                <strong style={{ color: 'var(--theme-text)' }}>Tanks:</strong>{' '}
                <span style={{ color: 'var(--theme-text-700)' }}>{roleCounts.tank}</span>
              </div>
            )}
            {roleCounts.dps > 0 && (
              <div>
                <strong style={{ color: 'var(--theme-text)' }}>DPS:</strong>{' '}
                <span style={{ color: 'var(--theme-text-700)' }}>{roleCounts.dps}</span>
              </div>
            )}
            {roleCounts.support > 0 && (
              <div>
                <strong style={{ color: 'var(--theme-text)' }}>Supports:</strong>{' '}
                <span style={{ color: 'var(--theme-text-700)' }}>{roleCounts.support}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default RosterCount


