'use client'

import React, { useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Calendar, PlusSquare, Users, ClipboardList, Building, BarChart3, Swords, FileText, Tv, Settings } from 'lucide-react'
import { WeeklyView } from './ProductionDashboard/WeeklyView'
import { StaffSignupsView } from './ProductionDashboard/StaffSignupsView'
import { AssignmentView } from './ProductionDashboard/AssignmentView'
import { ScheduleBuilderView } from './ProductionDashboard/ScheduleBuilderView'
import { SummaryView } from './ProductionDashboard/SummaryView'
import { BulkTournamentCreator } from './ProductionDashboard/BulkTournamentCreator'
import { MatchesListTab } from './ProductionDashboard/MatchesListTab'
import { TemplatesListTab } from './ProductionDashboard/TemplatesListTab'
import { StreamTrackerView } from './ProductionDashboard/StreamTrackerView'
import { SettingsView } from './ProductionDashboard/SettingsView'

export default function ProductionDashboardView() {
  const { user } = useAuth()
  
  // Check if user is a production manager (admin or staff-manager)
  const isProductionManager = user?.role === 'admin' || user?.role === 'staff-manager'
  const isAdmin = user?.role === 'admin'
  
  // Default tab: 'signups' for regular staff, 'weekly' for managers
  const [activeTab, setActiveTab] = useState(isProductionManager ? 'weekly' : 'signups')
  
  return (
    <div className="production-dashboard" data-section="production">
      <nav className="production-dashboard__tabs">
        {/* Only show management tabs to production managers */}
        {isProductionManager && (
          <>
            <button 
              className={`production-dashboard__tab ${activeTab === 'weekly' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              <Calendar size={14} />
              <span>Weekly View</span>
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'bulk' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              <PlusSquare size={14} />
              <span>Bulk Create</span>
            </button>
          </>
        )}
        
        {/* Staff Signups - visible to everyone */}
        <button 
          className={`production-dashboard__tab ${activeTab === 'signups' ? 'production-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('signups')}
        >
          <Users size={14} />
          <span>Staff Signups</span>
        </button>
        
        {/* Only show management tabs to production managers */}
        {isProductionManager && (
          <>
            <button 
              className={`production-dashboard__tab ${activeTab === 'assignment' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('assignment')}
            >
              <ClipboardList size={14} />
              <span>Assignment</span>
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'schedule' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <Building size={14} />
              <span>Schedule Builder</span>
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'summary' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <BarChart3 size={14} />
              <span>Summary</span>
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'streams' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('streams')}
            >
              <Tv size={14} />
              <span>Stream Tracker</span>
            </button>

            {/* Data tabs — embedded collection views */}
            <span className="production-dashboard__tab-divider" />
            <button 
              className={`production-dashboard__tab ${activeTab === 'matches' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              <Swords size={14} />
              <span>Matches</span>
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'templates' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              <FileText size={14} />
              <span>Templates</span>
            </button>
          </>
        )}
        {isAdmin && (
          <>
            <span className="production-dashboard__tab-divider" />
            <button 
              className={`production-dashboard__tab ${activeTab === 'settings' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={14} />
              <span>Settings</span>
            </button>
          </>
        )}
      </nav>
      
      <div className="production-dashboard__content">
        {activeTab === 'weekly' && isProductionManager && <WeeklyView />}
        {activeTab === 'bulk' && isProductionManager && <BulkTournamentCreator onSuccess={() => setActiveTab('signups')} />}
        {activeTab === 'signups' && <StaffSignupsView />}
        {activeTab === 'assignment' && isProductionManager && <AssignmentView />}
        {activeTab === 'schedule' && isProductionManager && <ScheduleBuilderView />}
        {activeTab === 'summary' && isProductionManager && <SummaryView />}
        {activeTab === 'streams' && isProductionManager && <StreamTrackerView />}
        {activeTab === 'matches' && isProductionManager && <MatchesListTab />}
        {activeTab === 'templates' && isProductionManager && <TemplatesListTab />}
        {activeTab === 'settings' && isAdmin && <SettingsView />}
      </div>
    </div>
  )
}
