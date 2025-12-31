'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedButton } from './SeedButton'
import { FixStaffButton } from './FixStaffButton'
import QuickStats from './QuickStats'
import AssignedTeamsDashboard from './AssignedTeamsDashboard'
import RecruitmentWidget from './RecruitmentWidget'
import { GradientBorder } from './GradientBorder'
import { useIsAdmin, useIsTeamManager } from '@/utilities/adminAuth'

const BeforeDashboard: React.FC = () => {
  const isAdmin = useIsAdmin()
  const isTeamManager = useIsTeamManager()

  return (
    <div>
      <Banner type="success">
        <h4>Welcome to Elemental CMS!</h4>
      </Banner>
      {/* <DataConsistencyDashboard /> - Removed, using sidebar link instead */}
      <AssignedTeamsDashboard />
      <QuickStats />
      <RecruitmentWidget />
      {isAdmin && (
        <>
          <GradientBorder>
            <div className="p-4 rounded">
              <strong className="text-yellow-400">🚀 Quick Start:</strong> Seed your database with initial team data from <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">teams.json</code>
              <div className="mt-2 text-sm">
                <strong className="text-yellow-400">⚠️ Note:</strong> "Seed Teams Only" will <strong>clear all existing teams</strong> and re-seed fresh data. All People entries will be recreated and linked properly.
              </div>
              <div className="mt-3">
                <SeedButton />
              </div>
            </div>
          </GradientBorder>
          <GradientBorder>
            <div className="p-4 rounded">
              <strong className="text-blue-400">🔧 Fix Staff Relationships:</strong> If staff pages aren't showing roles, this will link Organization Staff and Production Staff entries to People records.
              <div className="mt-3">
                <FixStaffButton />
              </div>
            </div>
          </GradientBorder>
        </>
      )}
      {isTeamManager && (
        <div className="manager-notification">
          <strong>👤 Team Manager:</strong> You have access to manage your assigned teams. 
          Visit the <strong>Teams</strong> collection to see which teams you can edit. 
          You can create new teams and edit your assigned teams, but other teams are read-only.
        </div>
      )}
      <p className="mb-4">
        Manage your teams, players, staff, and matches from this admin panel. Here&apos;s a quick guide:
      </p>
      <ul className="list-decimal mb-2 space-y-2">
        <li className="w-full">
          <strong>People</strong> - Centralized collection for all people (players, staff, casters, etc.). 
          {' '}
          <em>✨ NEW: Create people here first, then link them in teams and staff collections using the Person field.</em>
          {' '}
          This ensures consistency and makes updates easier.
        </li>
        <li className="w-full">
          <strong>Teams</strong> - Add and manage all Elemental teams. Use the tabs to organize Basic Info, Staff, and Roster.
          {' '}
          <em>Tip: Use the Person field to link to People collection (recommended), or use Name field for legacy entries.</em>
          {' '}
          If someone is both manager and coach, add them to both fields - they&apos;ll appear once with both roles.
        </li>
        <li className="w-full">
          <strong>Organization Staff</strong> - Manage owners, HR, moderators, and other org staff. Staff can have multiple roles.
          {' '}
          <em>Tip: Link to People collection using the Person field for better data management.</em>
        </li>
        <li className="w-full">
          <strong>Production Staff</strong> - Manage casters, observers, and producers for match broadcasts.
          {' '}
          <em>Tip: Link to People collection, and they can also be linked in matches as producers/observers or casters.</em>
        </li>
        <li className="w-full">
          <strong>Matches</strong> - Create and manage competitive matches. Link teams, add scores, streams, and VODs.
          {' '}
          <em>Tip: You can add multiple producers/observers per match - useful when one person does both roles or you have separate people.</em>
        </li>
        <li className="w-full">
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
      <GradientBorder>
        <div className="p-4 rounded">
          <strong className="text-green-400">✨ New People System:</strong>
          <ul className="mt-2 mb-0 pl-6 space-y-1">
            <li>Create people in the <strong>People</strong> collection first</li>
            <li>Link them in teams/staff using the <strong>Person</strong> field (recommended)</li>
            <li>Names and social links auto-fill from People when linked</li>
            <li>Legacy name fields still work for backward compatibility</li>
            <li>Use the migration endpoint to convert existing data: <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">POST /api/migrate-to-people</code></li>
          </ul>
        </div>
      </GradientBorder>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <em>Need help? Check the field descriptions in each collection for detailed guidance.</em>
      </p>
    </div>
  )
}

export default BeforeDashboard
