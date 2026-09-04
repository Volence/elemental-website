'use client'

import React from 'react'
import FaceitLeaguesHeader from '@/components/FaceitLeaguesHeader'
import FaceitTeamsPanel from './FaceitTeamsPanel'
import FaceitLeaguesTable from './FaceitLeaguesTable'

/**
 * The one FaceIt page: season status and rollover, every team's setup,
 * the league templates, and the finalized seasons. Registered as the list
 * view of the faceit-leagues collection so the nav entry and URL stay.
 */
export default function FaceitHub() {
  return (
    <div className="faceit-hub" data-section="faceit">
      <div className="faceit-hub__title">
        <h1>FaceIt</h1>
        <p>Season rollover, team setup, and league templates in one place.</p>
      </div>
      <FaceitLeaguesHeader />
      <FaceitTeamsPanel />
      <FaceitLeaguesTable />
    </div>
  )
}
