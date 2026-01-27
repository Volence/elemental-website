'use client'

import React, { useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { WeeklyView } from './ProductionDashboard/WeeklyView'
import { StaffSignupsView } from './ProductionDashboard/StaffSignupsView'
import { AssignmentView } from './ProductionDashboard/AssignmentView'
import { ScheduleBuilderView } from './ProductionDashboard/ScheduleBuilderView'
import { SummaryView } from './ProductionDashboard/SummaryView'
import { BulkTournamentCreator } from './ProductionDashboard/BulkTournamentCreator'

export default function ProductionDashboardView() {
  const { user } = useAuth()
  
  // Check if user is a production manager (admin or staff-manager)
  const isProductionManager = user?.role === 'admin' || user?.role === 'staff-manager'
  
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
              Weekly View
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'bulk' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk Create
            </button>
          </>
        )}
        
        {/* Staff Signups - visible to everyone */}
        <button 
          className={`production-dashboard__tab ${activeTab === 'signups' ? 'production-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('signups')}
        >
          Staff Signups
        </button>
        
        {/* Only show management tabs to production managers */}
        {isProductionManager && (
          <>
            <button 
              className={`production-dashboard__tab ${activeTab === 'assignment' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('assignment')}
            >
              Assignment
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'schedule' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              Schedule Builder
            </button>
            <button 
              className={`production-dashboard__tab ${activeTab === 'summary' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              Summary
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
      </div>
    </div>
  )
}
