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
  
  if (totalPlayers === 0) {
    return (
      <div className="team-tab-count team-tab-count--empty">
        No players on roster yet
      </div>
    )
  }

  return (
    <div className="team-tab-count team-tab-count--filled">
      <div className="team-tab-count__stats">
        <div className="team-tab-count__stat">
          <strong>Total Players:</strong>{' '}
          <span className="team-tab-count__stat-value team-tab-count__stat-value--primary">{totalPlayers}</span>
        </div>
        {rosterCount > 0 && (
          <div className="team-tab-count__stat">
            <strong>Active Roster:</strong>{' '}
            <span className="team-tab-count__stat-value">{rosterCount}</span>
          </div>
        )}
        {subsCount > 0 && (
          <div className="team-tab-count__stat">
            <strong>Substitutes:</strong>{' '}
            <span className="team-tab-count__stat-value">{subsCount}</span>
          </div>
        )}
        {Object.keys(roleCounts).length > 0 && (
          <>
            {roleCounts.tank > 0 && (
              <div className="team-tab-count__stat">
                <strong>Tanks:</strong>{' '}
                <span className="team-tab-count__stat-value">{roleCounts.tank}</span>
              </div>
            )}
            {roleCounts.dps > 0 && (
              <div className="team-tab-count__stat">
                <strong>DPS:</strong>{' '}
                <span className="team-tab-count__stat-value">{roleCounts.dps}</span>
              </div>
            )}
            {roleCounts.support > 0 && (
              <div className="team-tab-count__stat">
                <strong>Supports:</strong>{' '}
                <span className="team-tab-count__stat-value">{roleCounts.support}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default RosterCount




