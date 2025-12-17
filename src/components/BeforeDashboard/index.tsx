'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import { useAuth } from '@payloadcms/ui'
import React from 'react'

import { SeedButton } from './SeedButton'
import { FixStaffButton } from './FixStaffButton'
import DataConsistencyCheck from './DataConsistencyCheck'
import DataConsistencyDashboard from './DataConsistencyDashboard'
import QuickStats from './QuickStats'
import AssignedTeamsDashboard from './AssignedTeamsDashboard'
import { UserRole } from '@/access/roles'
import type { User } from '@/payload-types'
import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  const { user } = useAuth()
  // @ts-ignore - Payload ClientUser type compatibility issue
  const isAdmin = user && (user as User).role === UserRole.ADMIN

  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to Elemental CMS!</h4>
      </Banner>
      {/* <DataConsistencyDashboard /> - Removed, using sidebar link instead */}
      <AssignedTeamsDashboard />
      <QuickStats />
      {isAdmin && (
        <>
          <div className={`${baseClass}__info-box`}>
            <strong>🚀 Quick Start:</strong> Seed your database with initial team data from <code>teams.json</code>
            <div className={`${baseClass}__note-text`}>
              <strong>⚠️ Note:</strong> "Seed Teams Only" will <strong>clear all existing teams</strong> and re-seed fresh data. All People entries will be recreated and linked properly.
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <SeedButton />
            </div>
          </div>
          <div className={`${baseClass}__info-box-blue`}>
            <strong>🔧 Fix Staff Relationships:</strong> If staff pages aren't showing roles, this will link Organization Staff and Production Staff entries to People records.
            <div style={{ marginTop: '0.75rem' }}>
              <FixStaffButton />
            </div>
          </div>
          <DataConsistencyCheck />
        </>
      )}
      {/* @ts-ignore - Payload ClientUser type compatibility issue */}
      {user && (user as User).role === UserRole.TEAM_MANAGER && (
        <div className={`${baseClass}__info-box-green`} style={{ marginBottom: '1rem' }}>
          <strong>👤 Team Manager:</strong> You have access to manage your assigned teams. 
          Visit the <strong>Teams</strong> collection to see which teams you can edit. 
          You can create new teams and edit your assigned teams, but other teams are read-only.
        </div>
      )}
      <p style={{ marginBottom: '1rem' }}>
        Manage your teams, players, staff, and matches from this admin panel. Here&apos;s a quick guide:
      </p>
      <ul className={`${baseClass}__instructions`}>
        <li>
          <strong>People</strong> - Centralized collection for all people (players, staff, casters, etc.). 
          {' '}
          <em>✨ NEW: Create people here first, then link them in teams and staff collections using the Person field.</em>
          {' '}
          This ensures consistency and makes updates easier.
        </li>
        <li>
          <strong>Teams</strong> - Add and manage all Elemental teams. Use the tabs to organize Basic Info, Staff, and Roster.
          {' '}
          <em>Tip: Use the Person field to link to People collection (recommended), or use Name field for legacy entries.</em>
          {' '}
          If someone is both manager and coach, add them to both fields - they&apos;ll appear once with both roles.
        </li>
        <li>
          <strong>Organization Staff</strong> - Manage owners, HR, moderators, and other org staff. Staff can have multiple roles.
          {' '}
          <em>Tip: Link to People collection using the Person field for better data management.</em>
        </li>
        <li>
          <strong>Production Staff</strong> - Manage casters, observers, and producers for match broadcasts.
          {' '}
          <em>Tip: Link to People collection, and they can also be linked in matches as producers/observers or casters.</em>
        </li>
        <li>
          <strong>Matches</strong> - Create and manage competitive matches. Link teams, add scores, streams, and VODs.
          {' '}
          <em>Tip: You can add multiple producers/observers per match - useful when one person does both roles or you have separate people.</em>
        </li>
        <li>
          <strong>Pages</strong> - Edit website pages and content using the rich text editor.
        </li>
        <li>
          {'Visit the '}
          <a href="/" target="_blank" rel="noopener noreferrer">
            website
          </a>
          {' to see your changes live, or use the '}
          <a href="/teams" target="_blank" rel="noopener noreferrer">
            Teams page
          </a>
          {' or '}
          <a href="/staff" target="_blank" rel="noopener noreferrer">
            Staff page
          </a>
          {' to preview data.'}
        </li>
      </ul>
      <div className={`${baseClass}__info-box-green`}>
        <strong>✨ New People System:</strong>
        <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
          <li>Create people in the <strong>People</strong> collection first</li>
          <li>Link them in teams/staff using the <strong>Person</strong> field (recommended)</li>
          <li>Names and social links auto-fill from People when linked</li>
          <li>Legacy name fields still work for backward compatibility</li>
          <li>Use the migration endpoint to convert existing data: <code>POST /api/migrate-to-people</code></li>
        </ul>
      </div>
      <p className={`${baseClass}__help-text`}>
        <em>Need help? Check the field descriptions in each collection for detailed guidance.</em>
      </p>
    </div>
  )
}

export default BeforeDashboard
